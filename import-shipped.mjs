import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
const prisma = new PrismaClient();
const COMMIT = process.argv.includes("--commit");
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("BD open order's  11June2026.xlsx");
const ws = wb.worksheets[1];
function eff(r,c){ const m=ws.getRow(r).getCell(c); let v=m.value; if(v==null&&m.master&&m.master!==m)v=m.master.value; if(v&&typeof v==="object"&&"result"in v)v=v.result; if(v&&typeof v==="object"&&"text"in v)v=v.text; if(v&&typeof v==="object"&&"richText"in v)v=v.richText.map(t=>t.text).join(""); return v; }
const norm=s=>s==null?"":String(s).replace(/\s+/g," ").trim();
const slug=s=>s.toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"");
const styleCodeOf=s=>{ const m=norm(s).match(/^([A-Za-z]+\d+[A-Za-z]?)/); return m?m[1].toUpperCase():norm(s).slice(0,12).toUpperCase(); };

// parse
const rows=[];
for(let r=3;r<=ws.rowCount;r++){
  const po=norm(eff(r,4)); if(!po) continue;
  rows.push({ po, fac:norm(eff(r,2)), brand:norm(eff(r,3)), style:norm(eff(r,5)), qty:Number(eff(r,6))||0,
    carton:Number(eff(r,9))||null, container:norm(eff(r,10))||null,
    ex:eff(r,11) instanceof Date?eff(r,11):null, bl:norm(eff(r,12)), blDate:eff(r,13) instanceof Date?eff(r,13):null,
    telex:norm(eff(r,17)) });
}
const cleanBL=b=>b.split("(")[0].trim();

const factories=await prisma.factory.findMany();
const facByName=new Map(factories.map(f=>[f.name.toLowerCase(),f]));
const bCache=new Map(), brCache=new Map(), stCache=new Map();
async function ensureBuyer(n){ if(bCache.has(n))return bCache.get(n); let b=await prisma.buyer.findFirst({where:{name:n}}); if(!b&&COMMIT)b=await prisma.buyer.create({data:{name:n,code:slug(n)}}); bCache.set(n,b); return b; }
async function ensureBrand(buyer,code){ const k=`${buyer?.id}|${code}`; if(brCache.has(k))return brCache.get(k); let br=await prisma.brand.findFirst({where:{buyerId:buyer.id,code}}); if(!br&&COMMIT)br=await prisma.brand.create({data:{buyerId:buyer.id,name:code,code}}); brCache.set(k,br); return br; }
async function ensureStyle(brand,code,name){ const k=`${brand?.id}|${code}`; if(stCache.has(k))return stCache.get(k); let st=await prisma.style.findFirst({where:{brandId:brand.id,styleCode:code}}); if(!st)st=await prisma.style.findFirst({where:{styleCode:code}}); if(!st&&COMMIT)st=await prisma.style.create({data:{brandId:brand.id,styleCode:code,name:name.slice(0,80)}}); stCache.set(k,st); return st; }

// group
const poGroups=new Map(); // po -> {fac,brand,ex,styleQty:Map}
const blGroups=new Map(); // bl -> {container,carton,ex,blDate,telex, lines:Map(`${po}|${code}`->{po,code,qty})}
for(const x of rows){
  const g=poGroups.get(x.po)||{fac:x.fac,brand:x.brand,ex:x.ex,styleQty:new Map()}; poGroups.set(x.po,g);
  const code=styleCodeOf(x.style); g.styleQty.set(code,(g.styleQty.get(code)||0)+x.qty);
  if(x.bl){ const bl=cleanBL(x.bl); const b=blGroups.get(bl)||{container:x.container,carton:x.carton,ex:x.ex,blDate:x.blDate,telex:x.telex,lines:new Map()}; blGroups.set(bl,b);
    const lk=`${x.po}|${code}`; const ln=b.lines.get(lk)||{po:x.po,code,qty:0}; ln.qty+=x.qty; b.lines.set(lk,ln); }
}
console.log(`Parsed: ${poGroups.size} POs, ${blGroups.size} shipments (BL), ${rows.length} rows`);

let pos=0,olines=0,ships=0,slines=0,newStyles=0;
const olMap=new Map(); // `${po}|${code}` -> orderLineId
for(const [po,g] of poGroups){
  const fac=facByName.get(g.fac.toLowerCase());
  const [bn,bc]=g.brand.includes("-")?[g.brand.split("-")[0].trim(),g.brand.split("-").slice(1).join("-").trim()]:[g.brand,g.brand];
  const buyer=await ensureBuyer(bn); const brand=buyer?await ensureBrand(buyer,slug(bc)):null;
  if(!fac||!brand){ console.log(`skip PO ${po}: fac/brand unresolved`); continue; }
  if(!COMMIT){ pos++; for(const[code,q]of g.styleQty){ olines++; } continue; }
  let dbpo; try{ dbpo=await prisma.purchaseOrder.create({data:{poNumber:po,buyerId:buyer.id,brandId:brand.id,factoryId:fac.id,exFactoryDate:g.ex,currency:"USD",status:"SHIPPED",notes:"Imported from SHIPPED sheet"}}); pos++; }
  catch(e){ dbpo=await prisma.purchaseOrder.findFirst({where:{poNumber:po,buyerId:buyer.id,factoryId:fac.id}}); if(!dbpo){console.log(`skip PO ${po}: ${e.message.slice(0,60)}`);continue;} }
  for(const [code,q] of g.styleQty){
    const st=await ensureStyle(brand,code,code); if(!st){continue;} if(st.__created)newStyles++;
    try{ const ol=await prisma.orderLine.create({data:{poId:dbpo.id,styleId:st.id,colourKey:""}}); await prisma.orderLineSize.create({data:{orderLineId:ol.id,label:"PCS",position:0,qty:q,netFob:0,sellFob:0}}); olMap.set(`${po}|${code}`,ol.id); olines++; }catch(e){}
  }
}
const telexMap=t=>/rcvd|recei/i.test(t)?"RECEIVED":"PENDING";
for(const [bl,b] of blGroups){
  if(!COMMIT){ ships++; slines+=b.lines.size; continue; }
  let ship; try{ ship=await prisma.shipment.create({data:{reference:bl.slice(0,60),blNumber:bl.slice(0,60),containerNo:b.container,cartons:b.carton,exFactoryDate:b.ex,blDate:b.blDate,telexStatus:telexMap(b.telex),mode:"SEA"}}); ships++; }
  catch(e){ ship=await prisma.shipment.findFirst({where:{reference:bl.slice(0,60)}}); if(!ship){console.log(`skip BL ${bl}: ${e.message.slice(0,60)}`);continue;} }
  for(const [lk,ln] of b.lines){ const olid=olMap.get(lk); if(!olid)continue; try{ const sl=await prisma.shipmentLine.create({data:{shipmentId:ship.id,orderLineId:olid}}); await prisma.shipmentLineSize.create({data:{shipmentLineId:sl.id,label:"PCS",qty:ln.qty}}); slines++; }catch(e){} }
}
console.log(`${COMMIT?"COMMITTED":"DRY"} — POs:${pos} orderLines:${olines} shipments:${ships} shipmentLines:${slines}`);
console.log(`DB now: POs=${await prisma.purchaseOrder.count()} shipments=${await prisma.shipment.count()}`);
await prisma.$disconnect();
