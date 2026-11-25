// Tiny stack VM: an interpreter for make.fun's tiny stack ISA v1, written
// from the ISA spec. 32-bit wrapping integers, a 256-value data stack, a
// 64-entry call stack, 256 words of memory, output capped at 65,536 bytes
// and steps at 1,000,000. Traps end the run at once, keeping prior output.
// Check order per step: step limit, pc in range, known opcode, immediate
// fits, stack needs, the instruction's own traps, then its effect.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? process.env.INPUT_DIR ?? "/input";
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? process.env.OUTPUT_DIR ?? "/output";
// [immediate bytes, pops, pushes] per opcode; an absent opcode is unknown.
const META: Record<number, [number, number, number]> = {
  0x00: [0, 0, 0], 0x01: [1, 0, 1], 0x02: [4, 0, 1], 0x03: [0, 1, 0],
  0x04: [0, 1, 2], 0x05: [0, 2, 2], 0x06: [0, 2, 3], 0x07: [0, 3, 3],
  0x10: [0, 2, 1], 0x11: [0, 2, 1], 0x12: [0, 2, 1], 0x13: [0, 2, 1],
  0x14: [0, 2, 1], 0x15: [0, 2, 1], 0x16: [0, 2, 1], 0x17: [0, 1, 1],
  0x18: [0, 2, 1], 0x19: [0, 2, 1], 0x1a: [0, 2, 1], 0x1b: [0, 1, 1],
  0x1c: [0, 2, 1], 0x1d: [0, 2, 1], 0x1e: [0, 2, 1],
  0x20: [0, 2, 1], 0x21: [0, 2, 1], 0x22: [0, 2, 1],
  0x30: [2, 0, 0], 0x31: [2, 1, 0], 0x32: [2, 1, 0], 0x33: [2, 0, 0],
  0x34: [0, 0, 0], 0x40: [0, 1, 1], 0x41: [0, 2, 0],
  0x50: [0, 1, 0], 0x51: [0, 1, 0], 0x52: [0, 0, 1], 0x53: [0, 1, 0],
};
function execute(program: Buffer, input: Buffer): { output: Buffer; exitCode: number } {
  const mem = new Int32Array(256);
  const st: number[] = [];
  const ret: number[] = [];
  const out: number[] = [];
  let inPos = 0, pc = 0, steps = 0;
  const done = (code: number) => ({ output: Buffer.from(out), exitCode: code });
  const pop = () => st.pop() as number;
  const pair = (): [number, number] => { const b = pop(); return [pop(), b]; };
  for (;;) {
    if (steps >= 1_000_000) return done(10);
    if (pc < 0 || pc >= program.length) return done(9);
    const op = program[pc];
    const meta = META[op];
    if (meta === undefined) return done(5);
    const [imm, pops, pushes] = meta;
    if (pc + 1 + imm > program.length) return done(9);
    if (st.length < pops) return done(2);
    if (st.length - pops + pushes > 256) return done(3);
    steps += 1;
    const next = pc + 1 + imm;
    let jump: number | null = null;
    switch (op) {
      case 0x00: return done(0);
      case 0x01: st.push((program[pc + 1] << 24) >> 24); break;
      case 0x02: st.push(program.readInt32LE(pc + 1)); break;
      case 0x03: st.pop(); break;
      case 0x04: st.push(st[st.length - 1]); break;
      case 0x05: { const t = pop(), s = pop(); st.push(t, s); break; }
      case 0x06: st.push(st[st.length - 2]); break;
      case 0x07: { const c = pop(), b = pop(), a = pop(); st.push(b, c, a); break; }
      case 0x10: { const [a, b] = pair(); st.push((a + b) | 0); break; }
      case 0x11: { const [a, b] = pair(); st.push((a - b) | 0); break; }
      case 0x12: { const [a, b] = pair(); st.push(Math.imul(a, b)); break; }
      case 0x13: { const [a, b] = pair(); if (!b) return done(4); st.push(Math.trunc(a / b) | 0); break; }
      case 0x14: { const [a, b] = pair(); if (!b) return done(4); st.push((a % b) | 0); break; }
      case 0x15: { const [a, b] = pair(); if (!b) return done(4); st.push(Math.trunc((a >>> 0) / (b >>> 0)) | 0); break; }
      case 0x16: { const [a, b] = pair(); if (!b) return done(4); st.push(((a >>> 0) % (b >>> 0)) | 0); break; }
      case 0x17: st.push((-pop()) | 0); break;
      case 0x18: { const [a, b] = pair(); st.push(a & b); break; }
      case 0x19: { const [a, b] = pair(); st.push(a | b); break; }
      case 0x1a: { const [a, b] = pair(); st.push(a ^ b); break; }
      case 0x1b: st.push(~pop()); break;
      case 0x1c: { const [a, b] = pair(); st.push(a << (b & 31)); break; }
      case 0x1d: { const [a, b] = pair(); st.push(a >> (b & 31)); break; }
      case 0x1e: { const [a, b] = pair(); st.push((a >>> (b & 31)) | 0); break; }
      case 0x20: { const [a, b] = pair(); st.push(a === b ? 1 : 0); break; }
      case 0x21: { const [a, b] = pair(); st.push(a < b ? 1 : 0); break; }
      case 0x22: { const [a, b] = pair(); st.push(a >>> 0 < (b >>> 0) ? 1 : 0); break; }
      case 0x30: jump = next + program.readInt16LE(pc + 1); break;
      case 0x31: if (pop() === 0) jump = next + program.readInt16LE(pc + 1); break;
      case 0x32: if (pop() !== 0) jump = next + program.readInt16LE(pc + 1); break;
      case 0x33: if (ret.length >= 64) return done(7); ret.push(next); jump = program.readUInt16LE(pc + 1); break;
      case 0x34: if (!ret.length) return done(8); jump = ret.pop() as number; break;
      case 0x40: { const ad = pop(); if (ad < 0 || ad > 255) return done(6); st.push(mem[ad]); break; }
      case 0x41: { const ad = pop(), v = pop(); if (ad < 0 || ad > 255) return done(6); mem[ad] = v; break; }
      case 0x50: { const t = String(pop()); if (out.length + t.length > 65_536) return done(11); for (let i = 0; i < t.length; i++) out.push(t.charCodeAt(i)); break; }
      case 0x51: if (out.length >= 65_536) return done(11); out.push(pop() & 0xff); break;
      case 0x52: st.push(inPos < input.length ? input[inPos++] : -1); break;
      case 0x53: return done(pop() & 0xff);
    }
    pc = jump === null ? next : jump;
  }
}
for (let i = 1; i <= 40; i++) {
  const id = `i${String(i).padStart(3, "0")}`;
  const dir = join(IN_DIR, id);
  let program = Buffer.alloc(0);
  let input = Buffer.alloc(0);
  try { program = readFileSync(join(dir, "program.bin")); } catch { /* empty program traps 9 */ }
  try { input = readFileSync(join(dir, "input.bin")); } catch { /* empty input reads -1 */ }
  const result = execute(program, input);
  const answerDir = join(OUT_DIR, id);
  mkdirSync(answerDir, { recursive: true });
  writeFileSync(join(answerDir, "stdout.bin"), result.output);
  writeFileSync(join(answerDir, "exit.txt"), String(result.exitCode));
}
