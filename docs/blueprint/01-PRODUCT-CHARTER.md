# Product Charter

## Tầm nhìn

**The marketplace for AI-built products and the people who build them.**

AI làm việc xây phần mềm rẻ và nhanh hơn. VNX.SI làm cho việc **tìm, mua, tuỳ chỉnh và bán** phần mềm đó dễ hơn. Dài hạn, VNX.SI đi từ ý tưởng tới thị trường: idea → validate → tìm product có sẵn → customize → build → launch → tìm khách → grow.

## Vai trò sản phẩm

| Bên | Lời hứa |
|---|---|
| Client (SME, người không chuyên kỹ thuật) | Có ý tưởng? Tìm sản phẩm có sẵn, tuỳ chỉnh, hoặc xây mới. |
| Builder (dev độc lập, studio nhỏ) | Xây một lần. Bán nhiều lần. Được thuê để tuỳ chỉnh. |
| Platform | Ghép đúng người với đúng thứ, minh bạch về những gì đã được kiểm chứng. |

## Nguyên tắc cốt lõi

1. **Trung thực trước tăng trưởng.** Không bịa số liệu, review, testimonial. Số công khai chỉ từ dữ liệu thật và có ngưỡng (ADR-004).
2. **Xếp hạng không bán.** Không ai trả tiền để lên top (ADR-004). Sponsored chỉ là ô tách riêng có nhãn (ADR-008); hoa hồng partner không bao giờ là tín hiệu xếp hạng (ADR-007).
3. **Xác minh đọc được.** Huy hiệu nói rõ đã kiểm gì, ai kiểm, khi nào; không dùng sao.
4. **Model-agnostic.** Builder dùng công cụ AI nào cũng được; platform AI đi qua provider port (ADR-005).
5. **Tính toán trước sinh nội dung.** Giá, xếp hạng, thống kê do SQL tính; AI chỉ giải thích và xếp lại trong tập ứng viên đã tính (AI-ARCHITECTURE mục 5).
6. **Riêng tư mặc định.** Builder không thấy email client; không đưa PII vào prompt.
7. **Một người vận hành được.** Kiến trúc tối giản (một Worker, ADR-001); mọi việc lặp lại được tự động hóa.
8. **Đa ngôn ngữ từ đầu.** EN, VI, 简体, 繁體 (ADR-003).

## Persona

| Persona | Nhu cầu | Wave phục vụ |
|---|---|---|
| **Chủ SME Việt** (nhà hàng, phòng gym, trung tâm học) | Phần mềm chạy được ngay, giá rõ, nói tiếng Việt | 1–2 |
| **Client quốc tế / Hoa ngữ** | Phần mềm ngách giá tốt, builder đáng tin | 1–2 |
| **Solo builder Việt** | Kênh bán sản phẩm, nguồn việc tuỳ chỉnh | 1 |
| **Studio nhỏ** | Dòng dự án ổn định, hồ sơ uy tín | 1–3 |
| **Owner / admin** | Duyệt nhanh, ghép đúng, đo được chợ đang sống hay không | 1 |

## Kết quả theo wave

| Wave | Kết quả | Điều kiện sang wave sau |
|---|---|---|
| **1. Supply** | Builder tự đăng product; client tìm, xem, gửi Inquiry; client đăng request, admin ghép tối đa 5 builder | ~100 product published |
| **2. Demand + AI** | Client mô tả ý tưởng → AI ra 3 phương án (Buy / Customize / Build) + ước giá; AI matching; nội dung SEO kéo client | Có lead thật đều đặn |
| **3. Transaction** | Mua product, dự án có milestone, thanh toán và payout, review, gói bảo trì | Có giao dịch thật |
| **4. Idea → Market** | Request a Product công khai, Product Opportunity (gom nhu cầu trước khi build), AI agent hỗ trợ build | — |

## Thước đo bắc cầu (North Star theo wave)

| Wave | North Star | Chỉ số phụ |
|---|---|---|
| 1 | Số product `published` có ≥1 huy hiệu trên `listed` | builder approved; Inquiry/tuần; % Inquiry được trả lời trong 3 ngày; % request có ≥1 đề xuất |
| 2 | Số request/Inquiry dẫn tới builder được chọn mỗi tháng | % discovery → hành động; precision@5 matching |
| 3 | GMV và doanh thu platform | tỷ lệ hoàn tất milestone; tranh chấp; doanh thu định kỳ từ bảo trì |

## Ngoài phạm vi (hiện tại)

- Sponsored listing trong Wave 1. Sau Wave 1: ô tách riêng có nhãn theo ADR-008 (EPIC 23).
- Quảng cáo: chỉ thiết kế (ADR-009), chưa có lịch.
- App di động native.
- Thị trường dùng tiếng Hindi (thị trường Ấn Độ dùng EN).
- AI tự viết code cho client (Wave 4).
