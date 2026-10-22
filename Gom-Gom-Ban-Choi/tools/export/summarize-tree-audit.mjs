import {readFile,writeFile} from 'node:fs/promises';
const folder=new URL('../../docs/performance/',import.meta.url);
const d=JSON.parse(await readFile(new URL('tree-model-audit.json',folder),'utf8'));
const all=[...d.models,...d.bushes];
const high=all.filter(x=>x.triangles>=10000),medium=all.filter(x=>x.triangles>=5000&&x.triangles<10000);
const drawHeavy=all.filter(x=>x.draws>=50);
const rows=all.map(x=>`${x.id.padEnd(25)} ${String(x.triangles).padStart(7)} tris | ${String(x.meshes).padStart(3)} mesh | ${String(x.instances).padStart(3)} instances | ${String(x.geoKB).padStart(4)} KiB geometry | ${x.name}`).join('\n');
const text=`KIEM TRA MODEL CAY 3D - 2026-10-22

Siro: ban mep uon nhe da duoc luu trong syrup-autotile.png, syrup-autotile.svg va tools/export/build-syrup-atlas.mjs.

PHAM VI VA CACH DO
Do truc tiep buildModel() cho 23 mau trang tri thuc vat, them 4 bui goc vuon; danh muc co tong 240 model. Co tinh index/non-index va so luong InstancedMesh. So tris la hinh hoc mot luot ve co so, CHUA cong pass bong do, ID va outline, chua frustum culling. Geometry KiB khong gom texture, material hay bo nho CPU khac. Mesh/lauot ve co so chi la uoc tinh, khong phai so draw call GPU da profile. Khong do FPS tren dien thoai, vi vay day la danh sach uu tien kiem tra, KHONG ket luan model nao chac chan gay lag.

Nguong noi bo de xep uu tien (khong phai gioi han chuan): nang >=10.000 tris/model; trung binh 5.000-9.999. Trong 27 mau/cum da do: ${high.length} nang, ${medium.length} trung binh. Trung binh nhom nang: ${high.reduce((s,x)=>s+x.triangles,0)/high.length} tris; nhom trung binh: ${medium.reduce((s,x)=>s+x.triangles,0)/medium.length} tris. Co ${drawHeavy.length} mau tu 50 mesh tro len, can xem draw calls rieng.

KET QUA
${rows}

UU TIEN
1. Bon bui goc vuon: ${d.bushes.reduce((s,x)=>s+x.triangles,0)} tris/cum 4 bui, ${d.bushes.reduce((s,x)=>s+x.meshes,0)} mesh. La 3D lap lai bang InstancedMesh giam draw calls nhung khong giam tong tris ve. Cac mau vuon vuong/dai chi hien mot bo 4 bui (deco-room.mjs:1588,1600).
2. Catnip bush: 11.424 tris nhung chi 7 mesh; uu tien giam do min tan/la hon la gop mesh.
3. Tomato bed: 15.408 tris / 67 mesh; sunflower: 13.148 / 43; lavender patch: 12.314 / 136.
4. Flower beds 7.964 tris / 152 mesh va Corn bed 3.630 / 96: co the ton CPU submission hon la tris.
5. Cac cay lon Swing tree 3.320, Bench swing 4.070, Treehouse 4.208, Lemon tree bench 5.816 tris; trung binh 4.353,5. Ba cay swingtree da dung sprite canopy (276 tris la/cay), khong phai nhom high-poly nhat.

LOI HINH HOC CAY NEN
meadow.mjs:22 truyen sphereSegments(r) (mang [width,height]) vao tham so so cua SphereGeometry, dong thoi tru 3 tren mang. Ket qua: tan cua ${d.environmentBreakdown.trees.filter(x=>x.emptyMeshes>0).length}/46 cay nen va ${d.environmentBreakdown.shrubs.filter(x=>x.emptyMeshes>0).length}/40 cum bui nen co mesh rong. KHONG coi so tris thap nay la toi uu. Chua sua vi day la lan kiem tra, khong thay doi model.
Canh meadow hien tai do voi bounds x[-7,16], z[-7,7]: ${d.environment.triangles} tris / ${d.environment.meshes} mesh sau gop (truoc gop: ${d.environmentBreakdown.raw.meshes} mesh). So nay khong dai dien canh sau khi sua loi mesh rong hay moi bo cuc game.

GIOI HAN
Bon id fence-hedge, yfence-hedge, kfence-hedge, bwall-lavender thuoc luong tuong/rao, khong co trong buildModel(); chua do hinh hoc rieng. Khong cong tat ca bien the vao mot canh: do thay the cung slot khong cung xuat hien. Chi mat thuc vat trong pham vi da chon duoc thong ke, khong phai toan bo 240 model.

Tai lap: mo /tree-model-audit.html khi game server dang chay; du lieu day du trong tree-model-audit.json.
`;
await writeFile(new URL('tree-model-audit.txt',folder),text);
console.log(JSON.stringify({measured:all.length,high:high.length,medium:medium.length,drawHeavy:drawHeavy.length,bushTris:d.bushes.reduce((s,x)=>s+x.triangles,0)}));
