// Tiny stack VM: interprets the kit ISA (32-bit wrapping ints, 256-slot
// stack, 256 words of memory, calls, branches, input/output) and writes
// each instance's stdout bytes and exit code. Deterministic; the only I/O
// is reading the instances under the input dir and writing answers out.
import{readFileSync as A,mkdirSync as B,writeFileSync as C}from"node:fs";
import{join as j}from"node:path";
const I=process.env.MAKEFUN_INPUT_DIR||process.env.INPUT_DIR||"/input",O=process.env.MAKEFUN_OUTPUT_DIR||process.env.OUTPUT_DIR||"/output";
function R(p,g){
const s=new Int32Array(256);let t=0;const k=new Int32Array(64);let u=0;const m=new Int32Array(256),o=[];let q=0,x=0,E=0,d=0;const n=p.length;
L:while(1){
if(E>=1e6){d=10;break}
if(x<0||x>=n){d=9;break}
const h=p[x],w=h==1?1:h==2?4:h>=48&&h<=51?2:0;
if(x+1+w>n){d=9;break}
E++;const y=x+1+w;let z=y;
switch(h){
case 0:d=0;break L;
case 1:if(t>=256){d=3;break L}s[t++]=(p[x+1]<<24)>>24;break;
case 2:if(t>=256){d=3;break L}s[t++]=p[x+1]|p[x+2]<<8|p[x+3]<<16|p[x+4]<<24;break;
case 3:if(t<1){d=2;break L}t--;break;
case 4:if(t<1){d=2;break L}if(t>=256){d=3;break L}s[t]=s[t-1];t++;break;
case 5:if(t<2){d=2;break L}{const v=s[t-1];s[t-1]=s[t-2];s[t-2]=v}break;
case 6:if(t<2){d=2;break L}if(t>=256){d=3;break L}s[t]=s[t-2];t++;break;
case 7:if(t<3){d=2;break L}{const v=s[t-3];s[t-3]=s[t-2];s[t-2]=s[t-1];s[t-1]=v}break;
case 0x10:case 0x11:case 0x12:case 0x13:case 0x14:case 0x15:case 0x16:case 0x18:case 0x19:case 0x1a:case 0x1c:case 0x1d:case 0x1e:case 0x20:case 0x21:case 0x22:{
if(t<2){d=2;break L}
const b=s[t-1],a=s[t-2];let r;
if(h==0x10)r=(a+b)|0;else if(h==0x11)r=(a-b)|0;else if(h==0x12)r=Math.imul(a,b);
else if(h<=0x16){if(!b){d=4;break L}r=h==0x13?Math.trunc(a/b)|0:h==0x14?(a%b)|0:h==0x15?Math.floor((a>>>0)/(b>>>0))|0:((a>>>0)%(b>>>0))|0}
else if(h==0x18)r=a&b;else if(h==0x19)r=a|b;else if(h==0x1a)r=a^b;
else if(h==0x1c)r=a<<b;else if(h==0x1d)r=a>>b;else if(h==0x1e)r=(a>>>b)|0;
else if(h==0x20)r=a==b?1:0;else if(h==0x21)r=a<b?1:0;else r=(a>>>0)<(b>>>0)?1:0;
t--;s[t-1]=r;break}
case 0x17:if(t<1){d=2;break L}s[t-1]=(-s[t-1])|0;break;
case 0x1b:if(t<1){d=2;break L}s[t-1]=~s[t-1];break;
case 0x30:z=y+((p[x+1]|p[x+2]<<8)<<16>>16);break;
case 0x31:case 0x32:if(t<1){d=2;break L}{const v=s[--t];if((h==0x31)==(v==0))z=y+((p[x+1]|p[x+2]<<8)<<16>>16)}break;
case 0x33:if(u>=64){d=7;break L}k[u++]=y;z=p[x+1]|p[x+2]<<8;break;
case 0x34:if(!u){d=8;break L}z=k[--u];break;
case 0x40:if(t<1){d=2;break L}{const a=s[t-1];if(a<0||a>255){d=6;break L}s[t-1]=m[a]}break;
case 0x41:if(t<2){d=2;break L}{const a=s[t-1];if(a<0||a>255){d=6;break L}m[a]=s[t-2];t-=2}break;
case 0x50:if(t<1){d=2;break L}{const v=String(s[--t]);if(o.length+v.length>65536){d=11;break L}for(let i=0;i<v.length;i++)o.push(v.charCodeAt(i))}break;
case 0x51:if(t<1){d=2;break L}if(o.length>=65536){d=11;break L}o.push(s[--t]&255);break;
case 0x52:if(t>=256){d=3;break L}s[t++]=q<g.length?g[q++]:-1;break;
case 0x53:if(t<1){d=2;break L}d=s[--t]&255;break L;
default:d=5;break L;
}
x=z;
}
return{o:Buffer.from(o),d};
}
for(let i=1;i<=40;i++){
const id="i"+String(i).padStart(3,"0");let p=Buffer.alloc(0),g=Buffer.alloc(0);
try{p=A(j(I,id,"program.bin"))}catch{}
try{g=A(j(I,id,"input.bin"))}catch{}
const r=R(p,g),D=j(O,id);B(D,{recursive:true});C(j(D,"stdout.bin"),r.o);C(j(D,"exit.txt"),""+r.d);
}
