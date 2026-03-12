# 🎨 AD Map Management Console (React + Vite)

Giao diện quản trị hiện đại, chuyên nghiệp dành cho hệ thống quản lý bản đồ xe tự hành (AD Map System). Được thiết kế để tối ưu hóa trải nghiệm người dùng trong việc quản lý, theo dõi và cập nhật dữ liệu bản đồ.

## 📌 Tổng quan dự án (Project Overview)
Frontend đóng vai trò là bảng điều khiển (Dashboard) chính, cho phép quản trị viên xem danh sách các khu vực (Regions) và lịch sử các phiên bản bản đồ (Versions). Giao diện tập trung vào sự tối giản, hiệu quả và tốc độ.

## 🛠 Công nghệ sử dụng (Tech Stack)
- **Framework:** React 18+ (Vite)
- **Styling:** Tailwind CSS (Modern & Responsive)
- **State Management:** React Hooks (useState, useEffect)
- **API Client:** Axios
- **Iconography:** Heroicons / Lucide React
- **Typography:** Inter (Google Fonts)

## ✅ Các tính năng đã hoàn thành (Achievements)
1.  **Giao diện Premium:** Thiết kế Dashboard chuyên nghiệp với thanh Sidebar điều hướng thông minh.
2.  **Quản lý Khu vực (Region):** Tạo mới và chọn vùng bản đồ cần quản lý một cách trực quan.
3.  **Lịch sử Phiên bản:** Hiển thị danh sách các bản đồ đã tải lên dưới dạng Card với đầy đủ Metadata (Creator, UTM Zone, MGRS, ...).
4.  **Workflow Upload Nâng cao:** Modal upload file hỗ trợ chọn file đa định dạng (.osm, .pcd) cùng lúc.
5.  **Tải xuống Tiện lợi:** Các nút download được tích hợp trực tiếp trên từng phiên bản bản đồ.
6.  **Xử lý Lỗi & ID:** Đã xử lý triệt để các lỗi so sánh ID (ObjectId) và hiển thị trạng thái chọn vùng trong sidebar.
7.  **Sửa lỗi Code & UI:** Loại bỏ hoàn toàn lỗi "mất chữ" và lỗi TypeScript gạch đỏ trong code nguồn.
8.  **Favicon:** Cấu hình chuẩn hình ảnh đại diện của ứng dụng trên trình duyệt.

## 🚀 Hướng dẫn cài đặt & Chạy
1.  **Cài đặt dependencies:**
    ```bash
    npm install
    ```
2.  **Chạy ứng dụng (Development):**
    ```bash
    npm run dev
    ```
3.  **Build Production:**
    ```bash
    npm run build
    ```
    Ứng dụng mặc định chạy tại: `http://localhost:5173` (hoặc cấu hình theo Vite).

## 📅 Mục tiêu sắp tới (Roadmap)
- [ ] **2D Map Visualizer:** Hiển thị trực tiếp dữ liệu Lanelet2 (.osm) lên giao diện Web bằng Deck.gl hoặc Mapbox.
- [ ] **3D Pointcloud Viewer:** Tích hợp trình xem dữ liệu 3D .pcd ngay trên Dashboard.
- [ ] **Map Comparison:** So sánh sự thay đổi giữa hai phiên bản bản đồ khác nhau.
- [ ] **Advanced Filtering:** Lọc phiên bản theo ngày tháng, người tạo hoặc trạng thái (Stable/Beta).
- [ ] **Dark Mode Support:** Cung cấp giao diện tối cho môi trường vận hành thiếu sáng.

---
*Phát triển bởi Đội ngũ Mapping System - 2026*
