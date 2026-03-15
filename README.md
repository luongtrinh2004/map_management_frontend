# 🎨 AD Map Management Console (React + Vite)

Giao diện quản trị hiện đại, chuyên nghiệp dành cho hệ thống quản lý bản đồ xe tự hành. Cho phép preview nhanh 2D/3D, quản lý version và theo sát tiến độ mapping.

## 📌 Tổng quan dự án (Project Overview)

Frontend là trung tâm điều phối, cung cấp khả năng trực quan hóa dữ liệu HD Map (Lanelet2) và Point Cloud (PCD). Giao diện tối ưu cho Mapping Team upload và Developers preview chất lượng dữ liệu.

## 🛠 Công nghệ sử dụng (Tech Stack)

- **Framework:** React 18+ (Vite)
- **Visualization:**
  - **Deck.gl:** Render Lanelet Map (GeoJSON) mượt mà với GPU.
  - **Three.js:** Visualizer dữ liệu Point Cloud 3D với hiệu ứng đổ màu theo độ cao.
  - **Mapbox GL:** Nền bản đồ vệ tinh/light chuẩn xác.
- **Styling:** Tailwind CSS (Glassmorphism & High-tech UI)
- **Iconography:** Lucide React

## ✅ Tiến độ hiện tại (Phase 1 & 2 Status)

### Phase 1: Core Portal (Hoàn thành 100%)

- [x] **Dashboard Thống kê:** View tổng quan Region, Version và Last Update.
- [x] **Quản lý Region & Version:** Sidebar điều hướng mượt mà, modal upload thông minh.
- [x] **Metadata Viewer:** Hiển thị thông tin UTM, MGRS, Coordinate System chi tiết.
- [x] **Version Control UI:** Đánh dấu Stable version, Rollback phiên bản chỉ với 1 click.

### Phase 2: High-Tech Preview (Hoàn thành 100%)

- [x] **2D Lanelet Viewer:** Hiển thị lane boundaries (xanh), stop lines (đỏ), centerlines cực nét.
- [x] **3D Pointcloud Viewer:** Xem PCD mượt mà nhờ cơ chế downsampling, hỗ trợ xoay/phóng không gian 3D.
- [x] **Auto-Focus Engine:** Tự động "fly-to" vùng bản đồ ngay khi mở preview.

### Phase 3: Visual Analytics (Đang thực hiện - 20%)

- [x] **Diff Analysis Card:** Hiển thị biến động Node/Way và mật độ Point Cloud trực quan.
- [ ] **Visual Diff Map:** Hiển thị màu sắc khác biệt các lane mới/cũ trên bản đồ.

## 🚀 Hướng dẫn cài đặt & Chạy

1. **Cài đặt dependencies:** `npm install`
2. **Chạy ứng dụng (Dev):** `npm run dev` (Mặc định: `http://localhost:5173`)

## 📅 Kế hoạch phát triển (Roadmap)

- [ ] **Map Validation UI:** Hiển thị các điểm hở lane hoặc lỗi logic trực tiếp trên map.
- [ ] **Advanced Filter:** Lọc bản đồ theo khu vực địa lý trên bản đồ tổng.
- [ ] **Dark Mode:** Giao diện tối chuyên sâu cho Operational Center.

---
