## PHẦN 1 — THREE.JS

### 1) Scene, Camera, Renderer — "Trường quay 3D"

Hãy nghĩ như đang quay phim:

Scene = cái trường quay, nơi bạn đặt mọi thứ vào  
Camera = máy quay, góc nhìn của người xem  
Renderer = đạo diễn, người "chụp lại" cảnh đó và chiếu lên màn hình (canvas)

```js
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
const renderer = new THREE.WebGLRenderer()
renderer.render(scene, camera) // "Chụp" và hiển thị
```

Mỗi frame bạn gọi `render()` một lần — đó là lý do cần vòng lặp `requestAnimationFrame`.

### 2) Mesh = Geometry + Material — "Xương + Da"
Một vật thể 3D gồm 2 thứ:

Geometry = hình dạng, bộ xương (hộp, cầu, cylinder...)
Material = bề mặt, màu sắc, độ bóng...
Mesh = ghép cả hai lại thành vật thể thực sự

```js
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 })
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)
```

Trong BIM: mỗi cái cột, dầm, tường đều là một Mesh.

---

### 3) Scene Graph — "Cây gia đình"

Đây là phần **quan trọng nhất** bạn đã học. Ý tưởng cốt lõi:

> **Khi cha di chuyển/xoay, tất cả con cháu đi theo. Con di chuyển thì chỉ nó và cháu nó bị ảnh hưởng.**

Ví dụ cần cẩu bạn đã trả lời đúng:
```text
Thân cẩu (cha)
  └── Tay cẩu (con)
        └── Cáp cẩu (cháu)
```

```js
const thanCau = new THREE.Group()
const tayCau = new THREE.Group()
const capCau = new THREE.Mesh(...)

tayCau.add(capCau)
thanCau.add(tayCau)
scene.add(thanCau)

// Xoay thân → cả tay và cáp quay theo
thanCau.rotation.y += 0.01
```

**Tại sao quan trọng với BIM?** Vì một tòa nhà có cấu trúc:
```text
Dự án
  └── Tầng 1
        └── Phòng A
              └── Bồn rửa tay
```

Khi bạn dịch chuyển cả tòa nhà (ví dụ căn chỉnh tọa độ), mọi thứ bên trong tự động đi theo đúng vị trí.

### 4) Local vs World Position — "Địa chỉ nhà vs Địa chỉ GPS"
Đây là điểm tinh tế bạn đã hiểu đúng:

mesh.position.x → local = khoảng cách so với cha của nó
mesh.getWorldPosition(vec) → world = tọa độ thực so với gốc toàn bộ scene

```js
// Phòng ở tọa độ (100, 0, 100)
// Bồn rửa tay ở (1, 1, 0) so với phòng

console.log(sink.position.x) // → 1 (local)

const worldPos = new THREE.Vector3()
sink.getWorldPosition(worldPos)
console.log(worldPos.x) // → 101 (world = thực tế công trường)
```

Câu trả lời phỏng vấn: "Khi cần tọa độ thực để xuất báo cáo định vị công trình, em dùng getWorldPosition() thay vì đọc trực tiếp position vì position chỉ là tọa độ cục bộ so với vật cha."

### 5) Load GLTF — "Đưa Revit lên Web"
GLTF là định dạng chuẩn hiện đại cho 3D web — nhẹ, gom mesh + material + texture vào một file. Luồng luôn là:

```js
const loader = new GLTFLoader()

loader.load(
  'model.gltf',
  (gltf) => {
    // ✅ Load xong
    scene.add(gltf.scene)

    // Duyệt từng cấu kiện bên trong
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        console.log(child.name); // "Cot_A1", "Dam_B2"...
        child.castShadow = true
      }
    })
  },
  (xhr) => { /* đang load, hiện progress bar */ },
  (error) => { /* xử lý lỗi */ }
)
```

traverse() là từ khoá vàng — nó duyệt qua toàn bộ cây con, giúp bạn tìm đúng cấu kiện để đổi màu, gán sự kiện, lấy dữ liệu.

### 6) Raycasting — "Tia laser từ chuột"
Khi user click lên màn hình, bạn cần biết họ click vào vật thể nào trong không gian 3D. Cách Three.js làm: bắn một tia thẳng từ camera qua điểm chuột, xem nó va chạm vào Mesh nào trước.

```js
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

canvas.addEventListener('click', (e) => {
  // Chuyển tọa độ chuột sang hệ -1 đến 1
  mouse.x = (e.clientX / width) * 2 - 1
  mouse.y = -(e.clientY / height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(scene.children, true)

  if (hits.length > 0) {
    const clicked = hits[0].object // Vật thể gần nhất
    console.log(clicked.name) // "Mong_nha_A1"
    // → Hiện popup: mác bê tông, ngày đổ...
  }
})
```

**Dùng trong BIM:** Click vào móng nhà → hiện thông số kỹ thuật. Đây là tính năng cốt lõi của mọi app BIM viewer.

---

## PHẦN 2 — AUTODESK APS

### 7) APS Viewer vs Three.js thuần — "Khi nào dùng cái nào?"

| | Three.js | APS Viewer |
|---|---|---|
| File 3D | GLTF, OBJ... | RVT, DWG, IFC... (file kỹ thuật) |
| Chuyển đổi file | Tự làm | Có sẵn Model Derivative API |
| Công cụ BIM | Tự code hết | Có sẵn: đo đạc, section, properties |
| Tùy biến UI | Thoải mái | Bị giới hạn hơn |

**Câu trả lời chuẩn:** *"APS phù hợp khi dữ liệu gốc là file CAD/BIM nặng vì có sẵn bộ chuyển đổi và công cụ kỹ thuật. Three.js phù hợp khi cần tùy biến giao diện sâu hoặc làm hiệu ứng hình ảnh đặc biệt. Trong dự án thực tế có thể kết hợp cả hai."*

---

### 8) ExternalId — "Chìa khoá nối Model với Database"

Đây là khái niệm **cốt lõi** khi làm BIM web app:

- Mỗi cấu kiện trong model Revit có một `externalId` duy nhất (ví dụ `"COT-A1-T3"`)
- Backend DB cũng lưu dữ liệu tiến độ theo chính cái ID này
- APS Viewer dùng `dbId` (số nguyên nội bộ) để thao tác — cần map `externalId ↔ dbId`
```text
Revit model ←→ externalId ←→ Database backend
                    ↕
                   dbId
                    ↕
             APS Viewer API
```

### 9) Data Mapping với Map — "Tra cứu siêu tốc"
Khi backend trả về danh sách tiến độ, bạn convert sang Map để tra cứu O(1):
```js
// Backend trả về
const progressData = [
  { externalId: "COT-A1", status: "done", assignee: "Nguyễn" },
  { externalId: "DAM-B2", status: "pending", assignee: "Trần" },
];

// Convert sang Map để tra cứu nhanh
const progressMap = new Map(
  progressData.map(item => [item.externalId, item])
);

// Khi cần tra cứu
progressMap.get("COT-A1"); // → { status: "done", ... } — O(1), tức thì
```

Tại sao không dùng find() trên array? Vì find() là O(n) — với model có 50.000 cấu kiện, mỗi lần click phải duyệt hết list. Map.get() luôn O(1) dù list dài bao nhiêu.

### 10) Tô màu tiến độ lên Viewer
Đây là tính năng thực tế nhất — kết nối toàn bộ các khái niệm trên:

```js
// Duyệt qua từng cấu kiện trong model
viewer.getObjectTree((tree) => {
  tree.enumNodeChildren(tree.getRootId(), (dbId) => {

    // Lấy externalId của cấu kiện này
    viewer.getProperties(dbId, (props) => {
      const extId = props.externalId;

      // Tra Map — O(1)
      const data = progressMap.get(extId);

      if (data?.status === "done") {
        viewer.setThemingColor(dbId, new THREE.Vector4(0, 1, 0, 1)); // Xanh
      } else if (data?.status === "pending") {
        viewer.setThemingColor(dbId, new THREE.Vector4(1, 0, 0, 1)); // Đỏ
      } else {
        viewer.hide(dbId); // Không có data → ẩn đi
      }
    });
  });
});
```

---

## 🎯 Tóm tắt "kim chỉ nam" cho ngày mai
```
Three.js cơ bản:
Scene/Camera/Renderer → Mesh(Geometry+Material) → Scene Graph
       ↓
  Local vs World Position (getWorldPosition)
       ↓
  Load GLTF + traverse() → Raycasting (click)

APS thực chiến:
  Model file kỹ thuật → ExternalId là chìa khoá
       ↓
  Map<ExternalId, data> → tô màu/tương tác Viewer


  ẫn chưa hiểu  rõ, be cấp token con cho FE thì có phải token của APS cho BE không hay BE tự tạo token riêng còn BE gửi token cho APS riêng, 
giờ hàm initializer kia là cho ra redux, usecontext dùng chung hay là như nào

2:23 PM
Good catch — mình giải thích chưa rõ chỗ đó. Để mình vẽ ra cho trực quan:

Token — BE cấp cho FE cái gì?
Đúng là token APS — BE không tự tạo token riêng. BE chỉ đóng vai "trạm trung chuyển":

APS cấp token (60 phút)
         ↓
BE nhận token đó → trả NGUYÊN token đó xuống FE
         ↓
FE dùng token đó để init Viewer
Không có 2 token khác nhau. Chỉ có 1 token từ APS, BE giữ client_secret để xin token đó, rồi forward xuống FE.

Lý do phải qua BE thay vì FE gọi thẳng APS:

❌ FE gọi thẳng APS để lấy token
   → phải lộ client_secret trên browser
   → ai cũng thấy trong Network tab → không an toàn

✅ FE gọi BE của mình: GET /api/aps/token
   → BE dùng client_secret (trong env) gọi APS
   → APS trả token về BE
   → BE forward token xuống FE
   → client_secret không bao giờ ra khỏi server
Initializer chạy 1 lần — lưu ở đâu để dùng chung?
Autodesk.Viewing.Initializer chỉ cần chạy 1 lần duy nhất khi app khởi động — nó initialize toàn bộ APS SDK. Sau đó viewer instance mới là thứ bạn cần dùng đi dùng lại.

Thực tế có 3 cách lưu viewer instance:

Cách 1 — Custom Hook (phổ biến nhất)

typescript
// useAutodeskViewer.ts
const useAutodeskViewer = (containerId: string) => {
  const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null);

  useEffect(() => {
    Autodesk.Viewing.Initializer({ getAccessToken }, async () => {
      const viewer = new Autodesk.Viewing.GuiViewer3D(
        document.getElementById(containerId)
      );
      viewer.start();
      viewerRef.current = viewer;
    });

    return () => {
      viewerRef.current?.finish(); // cleanup khi unmount
    };
  }, []);

  return { viewer: viewerRef.current };
}
Component nào cần viewer thì gọi hook — nhưng mỗi component tạo ra 1 viewer riêng. Phù hợp khi app chỉ có 1 chỗ hiển thị model.

Cách 2 — Context (dùng chung nhiều component)

typescript
// ViewerContext.tsx
const ViewerContext = createContext<Autodesk.Viewing.GuiViewer3D | null>(null);

export const ViewerProvider = ({ children }) => {
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    Autodesk.Viewing.Initializer({ getAccessToken }, () => {
      const v = new Autodesk.Viewing.GuiViewer3D(...);
      v.start();
      setViewer(v);
    });
    return () => viewer?.finish();
  }, []);

  return (
    <ViewerContext.Provider value={viewer}>
      {children}
    </ViewerContext.Provider>
  );
}

// Dùng ở bất kỳ component con nào
const viewer = useContext(ViewerContext);
viewer?.setThemingColor(...);
Phù hợp khi toolbar, sidebar, panel đều cần gọi viewer — chỉ init 1 lần, dùng chung.

Cách 3 — Zustand/Redux (app lớn)

Ít dùng hơn vì viewer instance không nên serialize vào store (nó là object phức tạp). Thường chỉ lưu trạng thái liên quan đến viewer vào Redux, còn viewer instance thì vẫn để trong ref hoặc context:

typescript
// Redux chỉ lưu state, không lưu viewer instance
const viewerSlice = {
  isLoaded: false,
  selectedDbId: null,
  progressData: {},
}

// Viewer instance vẫn lưu trong Context/Ref
```

---

Tóm lại cách chọn:
```
Chỉ 1 trang dùng viewer      → custom hook
Nhiều component cùng tầng    → Context
Lưu data liên quan viewer    → Redux/Zustand
Viewer instance              → KHÔNG bỏ vào Redux
Rõ hơn chưa? Hay còn chỗ nào lấn cấn? 😄


Câu 3 — Hỏi xoáy về thực tế (APS + React)

"Em có useAutodeskViewer trong repo. Tại sao lại tách thành custom hook thay vì viết thẳng vào component?"
nếu viết thẳng component thì sau dùng lại cũng phải viết lại ở chỗ khác, hook dễ quản lý cũng như tôt cho việc xử lý2:05 PMNhận xét: 6/10 ⚠️
Bạn nói đúng ý nhưng còn khá chung chung — câu trả lời này ai cũng nói được, kể cả người chưa làm APS. Họ muốn nghe bạn nói cụ thể với Viewer.
Câu trả lời đầy đủ hơn nên có 3 lớp:
1. Reusability — bạn đã nói, đúng rồi.
2. Lifecycle management — đây là lý do quan trọng nhất với APS Viewer:

"Viewer cần được initialize khi mount và finish() khi unmount để giải phóng bộ nhớ. Nếu không cleanup đúng chỗ, mỗi lần navigate đi rồi quay lại sẽ tạo ra một Viewer mới đè lên canvas cũ — memory leak."

3. Separation of concerns — logic init Viewer, load model, đăng ký event... không nên nằm lẫn trong UI component.

Câu trả lời mẫu gộp lại:

"Vì Viewer có lifecycle riêng — cần init khi mount, cleanup khi unmount. Nếu để thẳng trong component thì dễ quên viewer.finish() gây memory leak. Tách ra hook giúp encapsulate toàn bộ logic đó, component chỉ cần gọi const { viewer } = useAutodeskViewer(containerId) là xong, dùng lại ở bất kỳ đâu."

Câu 5 — Câu khó nhất, hay bị hỏi bất ngờ 😈

"Em đang hiển thị một model tòa nhà 50 tầng, mỗi tầng 200 cấu kiện. User thấy lag khi kéo xoay model. Em sẽ debug và xử lý thế nào?"
tôi chưa có kinh nghiệm thực tế với aps, bạn trả lời giúp tôi2:07 PMCâu này hay ở chỗ họ không expect bạn biết hết — họ muốn xem tư duy debug của bạn. Vì bạn có nền 4 năm dev nên cách tiếp cận vấn đề mới là thứ họ đánh giá.
Câu trả lời mẫu chia 3 lớp:

Lớp 1 — Chẩn đoán trước, không đoán mò

"Đầu tiên em sẽ mở DevTools Performance tab, record lúc kéo xoay để xem bottleneck nằm ở CPU hay GPU, bao nhiêu ms mỗi frame, có function nào chạy quá lâu không."


Lớp 2 — Các hướng xử lý theo từng nguyên nhân
Nếu quá nhiều geometry đang render cùng lúc:

InstancedMesh — 200 cái cột giống hệt nhau thì chỉ cần 1 geometry, render 200 instance cùng lúc thay vì 200 draw call riêng
LOD (Level of Detail) — vật ở xa thì dùng geometry đơn giản hơn, gần mới dùng chi tiết

Nếu APS Viewer cụ thể:

Chỉ load tầng đang xem, ẩn các tầng còn lại bằng viewer.hide()
Bật viewer.setProgressiveRendering(true) — render dần dần thay vì cố render hết 1 frame

Nếu React re-render làm nặng thêm:

Đảm bảo component chứa Viewer không bị re-render không cần thiết — dùng React.memo hoặc tách state ra khỏi component đó


Lớp 3 — Câu chốt thể hiện kinh nghiệm

"Với dự án BIM thực tế, em nghĩ vấn đề hay gặp nhất là load toàn bộ model một lúc. Hướng xử lý đúng là lazy load theo tầng hoặc theo vùng — chỉ load những gì user đang nhìn thấy."


Cách dùng câu này trong phỏng vấn khi chưa có kinh nghiệm thực tế:

"Em chưa gặp bài toán này trực tiếp với APS, nhưng từ kinh nghiệm optimization chung em sẽ tiếp cận theo hướng..."

Nói thẳng là chưa gặp nhưng có hướng xử lý — tốt hơn nhiều so với im lặng hoặc bịa. Họ đánh giá cao sự thành thật kết hợp tư duy.


tôi chỉ muốn hỏi thêm bạn về aps và threejs, trước tiên tôi muốn hỏi
quy trình chuẩn thực tế là bản vẽ sẽ được upload lên aps và aps trả ra urn cho trình duyệt và load ra trình duyệt đúng không, token sẽ được quản lý như nào, hình như token chỉ được thời gian rất ngắn, aps có hỗ trợ tự refreshtoken như clerk không hay dev phải tự xác định refreshtoken implement, khi upload lên aps dùng với .net thì hình như k có async await đợi như js là bao giờ xong thì trả về cho client để show toast thành công, vậy thực tế làm thế nào để show cho user biết là thành công...

2:11 PM
Rất nhiều câu hay đấy — đây đúng là những thứ junior không hỏi, senior mới nghĩ tới. Mình giải thích từng cái:

1. Quy trình upload → URN → render
Đúng, flow chuẩn là:

User upload file (RVT, DWG...)
        ↓
.NET Backend nhận file → upload lên APS Object Storage (OSS)
        ↓
Gọi Model Derivative API để "dịch" file → GLTF/SVF2
        ↓
APS trả về URN (base64 encoded object ID)
        ↓
FE dùng URN + Access Token → Viewer load model ra browser
URN thực chất là id của file trên OSS được encode base64 — nó không đổi, lưu DB một lần dùng mãi.

2. Token — đây là phần thực tế nhất
APS có 2 loại token với 2 mục đích khác nhau:

Server-side token (2-legged) — Backend giữ, dùng để upload file, gọi API nội bộ. Client không bao giờ thấy cái này.

Client-side token (cũng 2-legged nhưng scope giới hạn) — Backend tạo ra rồi trả cho FE, FE dùng để init Viewer. Token này chỉ có quyền đọc/xem, không có quyền write.

Thời hạn token APS là 60 phút — không có refresh token như OAuth2/Clerk. Cách xử lý thực tế:

typescript
// FE gọi endpoint của BE để lấy token mới
const getViewerToken = async () => {
  const res = await fetch("/api/aps/token");
  const { access_token, expires_in } = await res.json();
  return { access_token, expires_in };
}

// Khi init Viewer, truyền hàm getToken vào
// APS Viewer tự gọi lại hàm này khi token sắp hết hạn
await Autodesk.Viewing.Initializer({
  getAccessToken: async (callback) => {
    const { access_token, expires_in } = await getViewerToken();
    callback(access_token, expires_in); // Viewer tự lo refresh
  }
});
```

APS Viewer **tự gọi lại `getAccessToken`** khi token sắp hết — nên dev không cần tự set interval. Nhưng cái hàm đó phải do **BE cấp**, không được hardcode token trên FE.

---

### 3. Upload .NET không có async như JS — Polling vs Webhook

Đây là bài toán thực tế hay gặp nhất. Model Derivative API **xử lý bất đồng bộ phía APS** — bạn gọi "dịch file" xong APS nói "ok tao đang làm" rồi cúp máy, không biết bao giờ xong.

Thực tế có **2 cách** xử lý:

**Cách 1 — Polling (đơn giản, hay dùng)**
```
FE upload xong → BE trả về jobId
        ↓
FE cứ mỗi 5 giây gọi GET /api/job/{jobId}/status
        ↓
BE gọi APS hỏi "job này xong chưa?"
        ↓
APS trả về: pending / inprogress / success / failed
        ↓
Khi success → FE show toast + load Viewer
typescript
// FE polling đơn giản
const pollStatus = async (jobId: string) => {
  const interval = setInterval(async () => {
    const { status } = await fetch(`/api/job/${jobId}/status`).then(r => r.json());

    if (status === "success") {
      clearInterval(interval);
      toast.success("Model đã sẵn sàng!");
      loadViewer(urn);
    } else if (status === "failed") {
      clearInterval(interval);
      toast.error("Chuyển đổi thất bại");
    }
  }, 5000);
}
```

**Cách 2 — Webhook (chuẩn hơn, phức tạp hơn)**
```
APS xong việc → tự gọi callback URL của BE
        ↓
BE nhận webhook → cập nhật DB → push thông báo xuống FE qua WebSocket/SSE
        ↓
FE show toast realtime
Cách này realtime hơn nhưng cần setup thêm WebSocket hoặc SSE — thường dùng cho production app lớn.

Câu trả lời phỏng vấn nếu họ hỏi:

"Em xử lý bằng polling — FE định kỳ hỏi BE về trạng thái job. Nếu scale lớn hơn thì em sẽ dùng APS Webhook kết hợp WebSocket để push realtime xuống client, tránh request thừa."

vậy làm sao FE hay BE biết token hết hạn mà gọi lại lấy token, rồi  token có lưu ở client k, token có đính kèm header như thông thường k, token đó là be tự tạo ra hay là token từ aps trả ra

2:19 PM
Câu hỏi rất sắc — đây là chỗ nhiều người làm APS mà vẫn mù mờ. Mình giải thích rõ từng cái:

1. Token đó là của ai tạo ra?
APS tạo ra, không phải BE tự tạo. Flow là:

BE gọi APS: POST /authentication/v2/token
  Body: client_id, client_secret, grant_type, scope

APS trả về:
{
  "access_token": "eyJhbGc...",
  "expires_in": 3600  // 60 phút
}
BE giữ client_id + client_secret trong env — FE không bao giờ biết 2 thứ này. BE dùng chúng để xin token từ APS, rồi token đó mới được trả xuống FE.

2. Token có lưu ở client không?
Có, nhưng có chủ đích. Luồng chuẩn:

BE lấy token từ APS
        ↓
BE trả token xuống FE (kèm expires_in)
        ↓
FE lưu trong memory (biến JS) — KHÔNG lưu localStorage
        ↓
FE truyền vào Viewer qua callback getAccessToken
Lý do không lưu localStorage: token này dù scope giới hạn nhưng vẫn là credential — lưu localStorage dễ bị XSS đánh cắp.

Lý do lưu memory được: tab đóng là mất, không persist, an toàn hơn.

3. Làm sao biết token hết hạn?
APS Viewer xử lý cái này tự động — đó là lý do callback getAccessToken được truyền vào lúc init thay vì truyền thẳng token string:

typescript
// ❌ Cách sai — truyền thẳng token, hết hạn là Viewer chết
Autodesk.Viewing.Initializer({ accessToken: "eyJ..." });

// ✅ Cách đúng — truyền hàm, Viewer tự gọi lại khi cần
Autodesk.Viewing.Initializer({
  getAccessToken: async (callback) => {
    // Hàm này được Viewer gọi lại tự động khi token sắp hết
    const { access_token, expires_in } = await fetch("/api/aps/token")
                                                .then(r => r.json());
    callback(access_token, expires_in);
  }
});
```

Viewer dựa vào `expires_in` để tự tính — kiểu như *"token này còn 3600 giây, tao sẽ gọi lại hàm `getAccessToken` trước khi hết hạn"*. Dev không cần set interval hay check thủ công gì cả.

---

### Token headers: when do we send `Authorization`?

**Có và không** — tùy ngữ cảnh:

- **FE gọi API của BE mình** (ví dụ lấy tiến độ, lưu data...) thì dùng token auth của app mình (JWT/session) như bình thường:

```http
Authorization: Bearer <app_jwt_token>
```

- **BE gọi APS API** (upload file, check job status...) thì BE đính kèm APS token vào header:

```http
Authorization: Bearer <aps_access_token>
```

- **Viewer chạy trên browser**: Viewer tự đính kèm token vào các request nội bộ của nó. Dev chỉ cần cung cấp token qua `getAccessToken` callback (không gọi APS trực tiếp từ FE).

---

Tóm gọn lại:

```text
APS tạo token → BE giữ bí mật client_secret
      ↓
BE forward token APS xuống FE (scope giới hạn)
      ↓
FE giữ token trong memory, truyền vào Viewer qua callback
      ↓
Viewer tự refresh bằng cách gọi lại callback khi cần
      ↓
BE gọi APS API thì tự đính header — FE không gọi APS trực tiếp
```

---

> Q: “BE cấp token cho FE thì có phải token APS cho BE không, hay BE tự tạo token riêng?”

Đúng là **token APS** — BE không tự tạo token riêng. BE chỉ là “trạm trung chuyển” để **không lộ `client_secret`**:

```text
APS cấp token (ví dụ ~60 phút)
         ↓
BE nhận token đó → trả NGUYÊN token đó xuống FE
         ↓
FE dùng token đó để init Viewer
```

Lý do phải qua BE thay vì FE gọi thẳng APS:

```text
❌ FE gọi thẳng APS để lấy token
   → phải lộ client_secret trên browser
   → ai cũng thấy trong Network tab → không an toàn

✅ FE gọi BE của mình: GET /api/aps/token
   → BE dùng client_secret (trong env) gọi APS
   → APS trả token về BE
   → BE forward token xuống FE
   → client_secret không bao giờ ra khỏi server
```

---

### Viewer init: lưu viewer instance ở đâu để dùng chung?

`Autodesk.Viewing.Initializer` chỉ cần chạy 1 lần để init SDK. Thứ bạn dùng đi dùng lại là **viewer instance**.

#### Cách 1 — Custom Hook (phổ biến khi chỉ có 1 nơi render viewer)

```ts
// useAutodeskViewer.ts
const useAutodeskViewer = (containerId: string) => {
  const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null)

  useEffect(() => {
    Autodesk.Viewing.Initializer({ getAccessToken }, async () => {
      const viewer = new Autodesk.Viewing.GuiViewer3D(document.getElementById(containerId))
      viewer.start()
      viewerRef.current = viewer
    })

    return () => {
      viewerRef.current?.finish()
    }
  }, [])

  return { viewer: viewerRef.current }
}
```

#### Cách 2 — Context (nhiều component cần gọi viewer: toolbar/sidebar/panel)

```ts
// ViewerContext.tsx
const ViewerContext = createContext<Autodesk.Viewing.GuiViewer3D | null>(null)

export const ViewerProvider = ({ children }) => {
  const [viewer, setViewer] = useState(null)

  useEffect(() => {
    Autodesk.Viewing.Initializer({ getAccessToken }, () => {
      const v = new Autodesk.Viewing.GuiViewer3D(...)
      v.start()
      setViewer(v)
    })
    return () => viewer?.finish()
  }, [])

  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>
}

// Any child component
const viewer = useContext(ViewerContext)
viewer?.setThemingColor(...)
```

#### Cách 3 — Zustand/Redux (app lớn)

Ít dùng hơn cho viewer instance vì viewer là object phức tạp. Thường:
- Redux/Zustand chỉ lưu **state liên quan viewer** (selectedDbId, filters, progress data...)
- viewer instance vẫn giữ trong **ref/context**

```ts
// Redux stores state only
const viewerSlice = {
  isLoaded: false,
  selectedDbId: null,
  progressData: {},
}
```

---

Tóm lại cách chọn:

```text
Chỉ 1 trang dùng viewer      → custom hook
Nhiều component cùng tầng    → Context
Lưu data liên quan viewer    → Redux/Zustand
Viewer instance              → KHÔNG bỏ vào Redux
```