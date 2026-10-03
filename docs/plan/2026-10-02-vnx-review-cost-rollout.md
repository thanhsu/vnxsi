# VNX: review kế hoạch, dự toán chi phí và kế hoạch triển khai

- **Ngày:** 2026-10-02
- **Tỷ giá dùng để quy đổi:** 1 USD ≈ 26.200 VND (giá bán Vietcombank ngày 02/10/2026, làm tròn lên vì thanh toán thẻ quốc tế có phí)
- **Liên quan:** [spec v0.1](../superpowers/specs/2026-10-02-vnx-v0.1-design.md)
- **Trạng thái:** **Superseded** (2026-10-03). Dự án đã pivot sang marketplace, xem [Marketplace Wave 1 spec](../superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md).

Mọi con số về token/task dưới đây là **ước tính**. Tuần đầu dogfood phải thay chúng bằng số đo thật từ bảng `model_runs`.

---

## 1. Hiện trạng (02/10/2026)

| Hạng mục | Trạng thái |
|---|---|
| Domain vnx.si | Đăng ký ở Hostinger, DNS trên Cloudflare (tài khoản dùng chung với vsnstock) |
| Landing v2 + waitlist | Live tại https://vnx.si, Worker `vnxsi-web`, D1 `vnxsi` |
| Email | contact@vnx.si qua Cloudflare Email Routing, chuyển tiếp về Gmail (chỉ nhận) |
| Spec v0.1 | Đã viết, chưa có code `apps/api` |
| Git | Chưa có commit nào |

---

## 2. Review kế hoạch

### 2.1 Giữ nguyên
- Làm một agent thật tốt trước (Developer Agent), dogfood trên project cá nhân.
- v0.1 chạy local, chưa public API.
- Chưa pricing, chưa marketplace, chưa microservice.
- `task_steps` / `model_runs` là trục chính: vừa là tính năng (timeline, cost), vừa là nguồn số đo cho chính tài liệu này.

### 2.2 Vấn đề cần quyết

**(1) Định vị: chưa trả lời được câu "khác gì Claude Code?"**
Luồng goal → plan → duyệt → sửa code → diff đã có ở Claude Code, Codex, Cursor, Copilot agent, Devin, OpenHands. Đề xuất chọn một hướng làm cái nêm:
- **A. Self-hosted, có policy và audit** (khuyến nghị): runtime chạy trong hạ tầng của bạn, đổi model tùy ý kể cả model local, mọi thao tác có duyệt và audit. Khách hàng mục tiêu là các team không được đưa code lên SaaS (tài chính, chứng khoán, doanh nghiệp). Chính SV Core là ví dụ.
- **B. Một runtime cho nhiều mảng** (code + nội dung + research). Khác biệt rõ, nhưng mỗi mảng có người mua khác nhau, nên khó bán.

**(2) "Miễn phí trong beta" có thể là khoản chi lớn nhất của dự án.**
Mỗi task của beta user tốn khoảng 1 USD tiền model (mục 3.2). 30 user × 30 task/tháng ≈ 900 USD/tháng do bạn trả. Đề xuất: beta dùng **BYOK** (user tự nhập API key của họ, VNX miễn phí phần mềm), đổi câu trên landing thành "Free during beta: bring your own model key".

**(3) Thước đo thành công còn yếu.**
"Làm được task rate limiting" mới là demo. Thước đo thật:
- **Dogfood:** sau 4 tuần, ≥ 50% việc code cá nhân bạn chọn giao cho VNX thay vì Claude Code.
- **Thị trường:** ≥ 100 email waitlist và ≥ 10 cuộc nói chuyện với người đăng ký trước khi mở beta.

**(4) Chưa có kế hoạch phân phối.** Landing đã live nhưng chưa có ai biết. Cần một kênh mỗi tuần (mục 5, Phase 1).

**(5) Thời gian.** Bạn đang làm full-time nên ước tính khoảng 10–12 giờ/tuần cho VNX. Các mốc ở mục 5 được tính theo giả định đó.

### 2.3 Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Agent chạy shell gây hỏng dữ liệu | Cao | Sandbox theo workspace, allowlist, mặc định cần duyệt, không có `git.push` ở v0.1 |
| Chi phí API vượt kiểm soát (vòng lặp vô hạn) | Trung bình | `max_turns` mỗi step, trần chi phí theo task và theo ngày ngay từ v0.1 |
| Lộ API key / secret | Cao khi public | Không public API ở v0.1; beta dùng Cloudflare Tunnel, key BYOK mã hóa |
| Cạnh tranh từ các tool lớn | Cao | Định vị A, không đua tính năng coding thuần |
| Bỏ dở vì thiếu thời gian | Trung bình | Plan nhỏ, mỗi plan có kết quả chạy được, mốc theo tuần |

---

## 3. Dự toán chi phí

### 3.1 Bảng giá dùng để tính (tháng 10/2026)

| Mục | Giá |
|---|---|
| Claude Sonnet 5.5 | $2 / $10 mỗi 1M token (input / output), cache read $0.20 |
| Claude Opus 5.5 | $4 / $20, cache read $0.20 |
| Claude Haiku 4.5 | $1 / $5 |
| Batch API | −50% (chỉ dùng cho việc không gấp) |
| Gemini 3.5 Flash-Lite | $0.30 / $2.50 |
| GPT-5.4 mini | $0.75 / $4.50 |
| Cloudflare Workers + D1 | Free plan đủ cho landing; Paid $5/tháng khi cần |
| Hetzner CX33 (4 vCPU, 8 GB) | €8.49/tháng (giá sau 15/06/2026, chưa gồm IPv4) |
| Mac mini M4 Pro 64 GB / 2 TB | 69.990.000 ₫ |
| RTX 5090 32 GB (chỉ card) | 114–190 triệu ₫ |

### 3.2 Chi phí model cho mỗi task (ước tính)

Giả định một task Developer Agent cỡ trung bình gồm khoảng 25 lần gọi model, mỗi lần khoảng 40K token input (khoảng 85% lấy từ prompt cache) và 1,5K token output (gồm cả phần thinking).

| Model | Input chưa cache | Cache read | Ghi cache | Output | **Tổng/task** |
|---|---|---|---|---|---|
| Sonnet 5.5 | $0.30 | $0.17 | ~$0.07 | $0.38 | **≈ $0.9** |
| Opus 5.5 | $0.60 | $0.17 | ~$0.15 | $0.75 | **≈ $1.7** |

Task nhỏ (sửa một file) khoảng $0.2–0.4; task lớn (nhiều module) khoảng $3–6. **Prompt cache là đòn bẩy chi phí lớn nhất:** nếu cache không ăn, chi phí input tăng khoảng 4 lần.

### 3.3 Theo giai đoạn

| Giai đoạn | Hạ tầng | Model API | **Tổng/tháng** |
|---|---|---|---|
| **Phase 1: v0.1 dogfood** (local, khoảng 5 task/ngày làm việc ≈ 110 task/tháng) | $0 (máy hiện có, Cloudflare free) | $60–180 | **$60–180 ≈ 1,6–4,7 triệu ₫** |
| **Phase 2: beta kín, BYOK** (10–30 user) | VPS ≈ $13 + Workers $0–5 | Chỉ phần dogfood của bạn ≈ $100 | **≈ $115–120 ≈ 3,0–3,1 triệu ₫** |
| Phase 2: beta kín, **bạn trả tiền model** | ≈ $13–18 | 10 user: ≈ $300; 30 user: ≈ $900 | **$400–1.000 ≈ 10–26 triệu ₫** |

Chi phí cố định khác:
- Gia hạn domain .si: theo hóa đơn Hostinger, mỗi năm một lần.
- Cloudflare Email Routing: miễn phí.
- Monitoring dùng free tier (Sentry, Grafana Cloud).
- Backup Postgres lên Cloudflare R2: miễn phí trong 10 GB đầu.
- Không tính các công cụ bạn đang trả để build (Claude Code / Codex).

### 3.4 Phần cứng

**Phase 1 không cần mua gì.** Máy dev hiện tại chạy Docker (Postgres + API) là đủ; nên có ≥ 16 GB RAM.

**Mua máy chạy model local chỉ hợp lý vì lý do riêng tư hoặc bán hàng, không phải để tiết kiệm.**
Model local chỉ thay được các bước rẻ (phân loại, tóm tắt, embedding). Qua API, các bước này tốn khoảng $5–15/tháng. Máy 70 triệu ₫ mất trên 15 năm mới hoàn vốn.

| Lựa chọn | Giá | Chạy được | Khi nào mua |
|---|---|---|---|
| Không mua; dùng Ollama trên máy hiện có + Gemini Flash-Lite cho bước rẻ | 0 ₫ | Model nhỏ 7–14B | **Mặc định cho Phase 1–2** |
| Mac mini M4 Pro 64 GB / 2 TB | ≈ 70 triệu ₫ (≈ $2.670) | Model 30–70B (lượng tử hóa), chạy êm, khoảng 60 W | Khi chế độ "Local only" trở thành điểm bán hàng (định vị A) và có khách hỏi |
| PC + RTX 5090 32 GB | ≈ 155–230 triệu ₫ | Nhanh hơn, VRAM 32 GB | Không khuyến nghị ở giai đoạn này |

### 3.5 Kiểm soát chi phí (đưa vào v0.1)
1. Trần chi phí: mỗi task $3, mỗi ngày $10 (cấu hình qua env). Vượt trần thì task chuyển PAUSED.
2. Mặc định dùng Sonnet 5.5; Opus 5.5 chỉ cho bước lập kế hoạch hoặc khi người dùng chọn "Best".
3. Thiết kế prompt để cache ăn được: system prompt và danh sách tool cố định đặt đầu; kiểm tra `cache_read_input_tokens` > 0.
4. Tuần 1 dogfood: xuất báo cáo cost/task thật từ `model_runs`, rồi cập nhật mục 3.2.

---

## 4. Kiến trúc triển khai theo giai đoạn

| | Phase 1 (local) | Phase 2 (beta kín) |
|---|---|---|
| Landing + waitlist | Cloudflare Worker (đã có) | Như cũ |
| API + runner | Docker Compose trên máy dev | Hetzner CX33, Docker Compose |
| Truy cập | `localhost` | `api.vnx.si` qua **Cloudflare Tunnel** (không mở port, có thể thêm Cloudflare Access) |
| Database | Postgres 16 + pgvector trong Compose | Như cũ + backup hằng ngày lên R2 |
| Sandbox | Thư mục workspace + allowlist | Mỗi task một container, mặc định không có mạng |
| Auth | Một token tĩnh | Đăng nhập GitHub OAuth + API key cá nhân |
| Model key | `.env` của bạn | BYOK, mã hóa khi lưu |

**Ghi chú:**
- Hetzner ở Đức/Phần Lan có độ trễ tới Việt Nam khoảng 250 ms. Với agent, phần lớn thời gian là chờ LLM nên không đáng kể. Hetzner cũng có region Singapore với giá cao hơn, có thể cân nhắc khi beta user chủ yếu ở châu Á.
- Đơn vị rủi ro là sandbox. Không mở beta khi chưa có container cô lập cho từng task.

---

## 5. Kế hoạch triển khai

| Phase | Thời gian (dự kiến) | Việc chính | Cổng để qua phase sau |
|---|---|---|---|
| **0. Nền tảng** | Xong 02/10/2026 | Landing v2, waitlist, domain, email | Đã đạt |
| **1a. API scaffold** | 05/10 → 19/10 | Plan 2 trong spec: Compose, schema, state machine, policy, sandbox tool, REST + SSE, scripted runner, test | Test tích hợp luồng đầy đủ pass |
| **1b. Claude thật** | 19/10 → 02/11 | Plan 3: `AnthropicProvider`, `LLMPlanner`, pricing, trần chi phí, trang debug timeline | Chạy được task rate limiting trên repo `vnxsi` |
| **1c. Dogfood** | 02/11 → 30/11 | Dùng VNX cho việc thật trên `vnxsi` và một project cá nhân thứ hai; đo cost/task | ≥ 50% việc code cá nhân giao cho VNX; cost/task đo được |
| **1d. Phân phối (song song 1a–1c)** | 05/10 → 30/11 | Mỗi tuần một bài (Viblo, các nhóm dev, X); viết build log; nói chuyện với người đăng ký | ≥ 100 email, ≥ 10 cuộc nói chuyện |
| **2a. Hardening** | 01/12 → 21/12 | Container sandbox, GitHub OAuth, BYOK, Tunnel, backup, MCP (GitHub/GitLab) | Security review tự làm, không còn lỗi mức cao |
| **2b. Beta kín** | 01/2027 → 03/2027 | Mời 5 → 10 → 30 người từ waitlist; thêm model thứ hai (OpenAI hoặc Gemini) | Có user quay lại hằng tuần; biết user giao việc gì và hỏng ở đâu |
| **3. Quyết định** | 03/2027 | Pricing, định vị cuối cùng, có làm local hardware / enterprise hay không | |

**Nếu cổng 1c không đạt** (chính bạn vẫn quay về Claude Code), dừng lại và tìm nguyên nhân trước khi làm Phase 2, không làm thêm tính năng.

---

## 6. Việc cần quyết ngay

1. Định vị: A (self-hosted, policy, audit) hay B (một runtime cho nhiều mảng).
2. Beta: BYOK hay bạn trả tiền model. Sau đó sửa câu "miễn phí trong beta" trên landing.
3. Ngân sách API cho Phase 1: đề xuất trần $150/tháng.
4. Commit repo hiện tại (spec, landing, migration, tài liệu này).

---

## Nguồn giá

- Claude API pricing: bảng model trong Claude API skill (cập nhật 2026-09-25)
- [Hetzner price adjustment 15/06/2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [OpenAI API pricing, Oct 2026](https://benchlm.ai/openai/api-pricing) · [Gemini API pricing, Oct 2026](https://benchlm.ai/google/api-pricing)
- [Mac mini M4 Pro 64GB, CellphoneS](https://cellphones.com.vn/apple-mac-mini-m4-pro-12cpu-16gpu-64gb-2tb-2024.html) · [RTX 5090, An Phát](https://www.anphatpc.com.vn/vga-rtx-5090.html) · [RTX 5090, GearVN](https://gearvn.com/collections/vga-rtx-5090-series)
- [Tỷ giá USD/VND 02/10/2026](https://chogia.vn/ngoai-te/usd/)
