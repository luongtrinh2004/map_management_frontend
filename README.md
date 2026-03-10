# 🎨 AD Map System - Frontend (React)

Giao diện quản trị viên dùng để quản lý vùng (Region) và tải lên các phiên bản bản đồ.

## 🚀 Hướng dẫn khởi chạy
1.  **Di chuyển vào thư mục:** `cd ad-map-system/frontend`
2.  **Cài đặt thư viện:** `npm install`
3.  **Chạy App:** `npm run dev -- --port 6061`
4.  **Truy cập:** [http://localhost:6061](http://localhost:6061)

## 📖 Hướng dẫn sử dụng
1.  **Tạo Region:** Nhấn `Add Region` để định nghĩa vùng map mới (VD: Phenikaa).
2.  **Upload Map:**
    *   Chọn đúng mã vùng (Region Code).
    *   Điền tên phiên bản (VD: v1.1).
    *   Chọn file `.osm` và `.pcd` tương ứng từ máy tính.
    *   Nhấn `Upload` và đợi thông báo thành công.

## 🛠 Mục tiêu đã đạt được (Phase 1)
-   Giao diện quản lý trực quan dùng Tailwind CSS.
-   Luồng upload file đa phần (Multipart upload) trực tiếp lên backend.
-   Đồng bộ dữ liệu thời gian thực với Cơ sở dữ liệu của hệ thống.

## 📅 Roadmap phát triển
### Phase 2 (Sắp tới)
-   **Visualizer 2D:** Sử dụng Deck.gl để hiển thị trực tiếp các làn đường, biển báo từ file OSM.
-   **Visualizer 3D:** Tích hợp Potree Viewer để soi chi tiết Point Cloud 3D ngay trên trình duyệt.
### Phase 3
-   **Map Diff Viewer:** Hiển thị sự khác biệt giữa v1.0 và v1.1 bằng màu sắc.
-   **Audit Log:** Theo dõi lịch sử ai đã upload và thay đổi dữ liệu bản đồ.
