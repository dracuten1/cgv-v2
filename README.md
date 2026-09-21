# Cây Gia Phả (CGP) v2

Nền tảng quản lý cây gia phả gia đình & dòng họ chuẩn hiện đại, mã nguồn mở 100%, tự lưu trữ (self-hosted), không chi phí bản quyền và không phụ thuộc dịch vụ SaaS trả phí.

Kiến trúc phân tách (split-stack):
- **Backend**: Go 1.22 REST API (Gin, pgx/v5, PostgreSQL 16, Excelize, Web Push VAPID).
- **Frontend**: Vue 3 SPA (Vite 5, Tailwind CSS 4, Pinia, Vue Router, PWA).
- **Điều phối & Triển khai**: Docker Compose đa môi trường với mạng phân tầng cô lập (dual-tier network).

---

## Mục lục

1. [Khởi động nhanh (Quickstart)](#1-khởi-động-nhanh-quickstart)
2. [Chế độ Demo (Mode A Demo)](#2-chế-độ-demo-mode-a-demo)
3. [Bảng ánh xạ cổng (Port Map)](#3-bảng-ánh-xạ-cổng-port-map)
4. [Hướng dẫn cấu hình (Environment Variables)](#4-hướng-dẫn-cấu-hình-environment-variables)
5. [Kiến trúc hệ thống (Monorepo Architecture)](#5-kiến-trúc-hệ-thống-monorepo-architecture)
6. [Các bất biến cốt lõi (Core Invariants INV-01..05)](#6-các-bất-biến-cốt-lõi-core-invariants-inv-0105)
7. [Kiểm thử & Phát triển (Testing & Development)](#7-kiểm-thử--phát-triển-testing--development)

---

## 1. Khởi động nhanh (Quickstart)

Chỉ với một câu lệnh duy nhất từ thư mục gốc dự án:

```bash
# 1. Khởi tạo file cấu hình môi trường từ mẫu
cp deploy/.env.example .env

# 2. Xây dựng và khởi chạy toàn bộ cụm dịch vụ nền tảng (cgp-v2)
docker compose up --build
```

Sau khi khởi chạy thành công:
- Giao diện Web: [http://localhost:3456](http://localhost:3456)
- API Healthcheck: [http://localhost:3456/api/v1/health](http://localhost:3456/api/v1/health) hoặc [http://localhost:3456/healthz](http://localhost:3456/healthz)

Dữ liệu mẫu ban đầu (3 dòng họ, 53 thành viên, 5 thế hệ) sẽ tự động nạp (AutoSeed) khi cơ sở dữ liệu trống.

Dừng hệ thống:
```bash
docker compose -f deploy/docker-compose.yml down
```

---

## 2. Chế độ Demo (Mode A Demo)

Chế độ Demo (`docker-compose.demo.yml`) cung cấp môi trường trải nghiệm hoàn toàn độc lập với hệ thống chính, tuân thủ nguyên tắc cách ly vật lý và logic nghiêm ngặt (INV-04 / ADR-011):

- **Phân tách hoàn toàn**: Database riêng (`cgp_demo_pgdata`), mạng riêng (`front-demo` / `back-demo`), cổng riêng (**3457**).
- **Bảo mật**: JWT Issuer riêng (`cgp-demo`), Session Cookie riêng (`cgp_demo_session`).
- **An toàn tài khoản**: Danh tính người dùng Demo không bao giờ được phép gộp hay liên kết với tài khoản thực.
- **Fail-fast**: Yêu cầu bắt buộc `JWT_SECRET` tối thiểu 32 ký tự, ngăn chặn mọi cấu hình thiếu an toàn ngay trước khi mở cổng mạng.

Khởi chạy cụm Demo:

```bash
docker compose -f deploy/docker-compose.demo.yml --env-file deploy/.env.example up -d --build
```

Truy cập Demo Web: [http://localhost:3457](http://localhost:3457)

Dừng cụm Demo:
```bash
docker compose -f deploy/docker-compose.demo.yml down
```

---

## 3. Bảng ánh xạ cổng (Port Map)

| Dịch vụ | Môi trường | Cổng Host | Cổng Container | Phạm vi truy cập | Ghi chú |
|---------|-----------|-----------|----------------|------------------|---------|
| **web** (Nginx) | Main (`cgp-v2`) | `3456` | `80` | Công khai (Host) | Phục vụ SPA & reverse proxy `/api/` |
| **web** (Nginx) | Demo (`cgp-demo`) | `3457` | `80` | Công khai (Host) | Phục vụ Demo SPA & reverse proxy |
| **api** (Go REST) | Main / Demo | *Không publish* | `8080` | Mạng nội bộ (`front-net`) | Chỉ Nginx kết nối đến API |
| **postgres** | Main / Demo | *Không publish* | `5432` | Mạng nội bộ (`back-net`, `internal: true`) | Chỉ API kết nối đến PostgreSQL |

---

## 4. Hướng dẫn cấu hình (Environment Variables)

Hệ thống đọc cấu hình từ file `.env` (dựa trên mẫu `deploy/.env.example`). Toàn bộ biến môi trường được định nghĩa và kiểm tra hợp lệ tại `api/internal/config/config.go`:

| Biến môi trường | Mặc định | Bắt buộc | Mô tả chức năng |
|-----------------|----------|----------|-----------------|
| `PORT` | `8080` | Không | Cổng mạng nội bộ API lắng nghe |
| `APP_ENV` | `prod` | Không | Môi trường hoạt động: `dev`, `demo`, `prod` |
| `DEMO_MODE` | `false` | Không | Kích hoạt ràng buộc cô lập Mode A Demo |
| `PUBLIC_BASE_URL` | `http://localhost:3456` | Có (prod/demo) | URL gốc công khai của ứng dụng |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3456,http://localhost:3457` | Không | Danh sách các nguồn CORS được cấp phép |
| `AUTO_SEED` | `true` | Không | Tự động chạy migration và nạp dữ liệu mẫu ban đầu |
| `DATABASE_URL` / `CGP_DB_DSN` | *(Chuỗi kết nối PostgreSQL)* | Có | Chuỗi kết nối PostgreSQL (phải chứa `demo` nếu ở chế độ Demo) |
| `POSTGRES_USER` | `cgp_user` | Không | Tên người dùng quản trị PostgreSQL trong Compose |
| `POSTGRES_PASSWORD` | `cgp_secure_password_2026` | Không | Mật khẩu cơ sở dữ liệu PostgreSQL trong Compose |
| `POSTGRES_DB` | `cgp_db` | Không | Tên database khởi tạo trong Compose |
| `JWT_SECRET` | *(chuỗi bí mật)* | Có | Khóa ký HMAC-SHA256 (tối thiểu 32 ký tự ở demo/prod) |
| `JWT_ISSUER` | `cgp-prod` (hoặc `cgp-demo`) | Không | Tên định danh tổ chức phát hành token |
| `COOKIE_NAME` | `cgp_session` (hoặc `cgp_demo_session`) | Không | Tên HTTP cookie lưu phiên đăng nhập |
| `MOCK_OAUTH_ENABLED` | `false` | Không | Bật đăng nhập giả lập cho dev (CẤM trong demo/prod) |
| `ZALO_CLIENT_ID` / `_SECRET` | *(rỗng)* | Tùy chọn | Định danh ứng dụng đăng nhập Zalo |
| `GOOGLE_CLIENT_ID` / `_SECRET` | *(rỗng)* | Tùy chọn | Định danh ứng dụng đăng nhập Google |
| `FACEBOOK_CLIENT_ID` / `_SECRET` | *(rỗng)* | Tùy chọn | Định danh ứng dụng đăng nhập Facebook |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `_FROM` | *(rỗng, port 587)* | Tùy chọn | Cấu hình máy chủ gửi thư điện tử Magic Link |
| `VAPID_PUBLIC_KEY` / `_PRIVATE_KEY` | *(rỗng)* | Tùy chọn | Cặp khóa VAPID cho thông báo đẩy Web Push |

---

## 5. Kiến trúc hệ thống (Monorepo Architecture)

```
cgp-v2/
├── api/                       # Go REST API backend
│   ├── cmd/server/            # Điểm khởi chạy ứng dụng (main.go)
│   ├── internal/
│   │   ├── auth/              # Xác thực đa kênh, liên kết tài khoản & JWT
│   │   ├── config/            # Quản lý cấu hình & kiểm soát bất biến INV-04
│   │   ├── database/          # Kết nối pgxpool & migration tự động
│   │   ├── excel/             # Nhập/xuất danh sách Excelize (INV-03)
│   │   ├── feed/              # Bản tin gia đình & bài viết
│   │   ├── handler/           # Gin HTTP route handlers
│   │   ├── kinship/           # Bộ suy diễn danh xưng họ hàng (INV-05)
│   │   ├── model/             # Định nghĩa cấu trúc dữ liệu
│   │   ├── push/              # Dịch vụ thông báo Web Push VAPID
│   │   ├── repository/        # Tầng truy xuất dữ liệu (auth, genealogy, social)
│   │   └── seed/              # Dữ liệu mẫu khởi tạo chuẩn
│   └── migrations/            # Các tập tin SQL định nghĩa lược đồ DB
├── web/                       # Vue 3 Single Page Application
│   ├── src/
│   │   ├── components/        # Component giao diện (Tree, Kinship, Form)
│   │   ├── views/             # Các trang màn hình chính
│   │   ├── stores/            # Quản lý trạng thái với Pinia
│   │   └── router/            # Điều hướng & bảo vệ route Vue Router
│   └── dist/                  # Artifacts đóng gói sẵn sàng triển khai
├── deploy/                    # Hạ tầng & Triển khai Docker
│   ├── Dockerfile.api         # Đóng gói Go API (multi-stage, alpine non-root)
│   ├── Dockerfile.web         # Đóng gói Vue 3 SPA (multi-stage Node -> Nginx)
│   ├── nginx.conf             # Nginx reverse proxy, cache assets & CSP header
│   ├── docker-compose.yml     # Ngăn xếp chính cgp-v2 (Port 3456)
│   ├── docker-compose.demo.yml# Ngăn xếp Demo cgp-demo (Port 3457)
│   └── .env.example           # File mẫu biến môi trường chuẩn hóa
└── README.md                  # Tài liệu hướng dẫn dự án
```

---

## 6. Các bất biến cốt lõi (Core Invariants INV-01..05)

Dự án CGP v2 cam kết tuân thủ 5 bất biến kỹ thuật nền tảng theo tài liệu đặc tả kiến trúc:

- **INV-01 (Zero Cost & Zero Subscriptions)**: 100% mã nguồn mở (MIT/Apache/BSD). Không sử dụng bất kỳ dịch vụ SaaS trả phí nào (không Firebase, Auth0, Stripe, Twilio hay Apple Sign-In). Phông chữ nhúng nội bộ (@fontsource), hoàn toàn độc lập và vận hành offline trên một máy chủ cục bộ.
- **INV-02 (Vietnamese-First Localization)**: 100% nhãn giao diện, thông báo lỗi, điều hướng, tiêu đề đời (`Đời thứ 1`, `Đời thứ 2`...) đều bằng tiếng Việt có dấu chuẩn xác. Cấu hình kiểu chữ chống cắt dấu thanh (`line-height ≥ 1.45`).
- **INV-03 (Bi-Directional Gender Mapping)**: Giá trị giới tính tiếng Việt `'nam'` / `'nữ'` (không phân biệt hoa thường) ánh xạ hai chiều tuyệt đối với giá trị cơ sở dữ liệu/API `'male'` / `'female'` qua tất cả các tầng: database, API JSON payloads, Excel import/export và biểu mẫu Vue.
- **INV-04 (Mode A Demo Isolation & Fail-Fast Startup)**: Môi trường Demo cách ly hoàn toàn về vật lý và logic: database/schema riêng, session cookie riêng (`cgp_demo_session`), JWT issuer riêng (`cgp-demo`). Không cho phép gộp tài khoản demo với tài khoản thực. Hệ thống kiểm tra cấu hình nghiêm ngặt ngay khi nạp (`ValidateOrDie`), thoát ngay lập tức (`os.Exit(1)`) trước khi mở cổng mạng nếu phát hiện cấu hình không hợp lệ.
- **INV-05 (Kinship DOM Bare Text Contract)**: Danh xưng họ hàng trong `KinshipResult.vue` được hiển thị dưới dạng văn bản thuần trong DOM (`textContent === "Ông nội"`). Dấu ngoặc kép trang trí bắt buộc chỉ được tạo thông qua CSS pseudo-elements `::before` và `::after`, tuyệt đối không chèn ký tự ngoặc kép vào chuỗi văn bản DOM.

---

## 7. Kiểm thử & Phát triển (Testing & Development)

Kiểm thử tự động cho từng thành phần:

```bash
# Kiểm thử toàn bộ API Backend (Go)
cd api && go test -v ./...

# Kiểm thử Giao diện Frontend (Vue 3 / Vitest)
cd web && npm run test
```
