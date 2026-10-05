# VNX.SI Ops Console — Design Spec

- **Ngày:** 2026-10-05
- **Trạng thái:** Phạm vi đã được Reviewer duyệt để làm cơ sở cho O1; các quyết định về quyền bên dưới được Owner xác nhận ngày 2026-10-05. Các tiêu chí UI là yêu cầu thiết kế cần review bằng mockup trước khi viết code.
- **Phạm vi:** chuyển khu vực vận hành nội bộ từ `/admin/...` sang console `/ops/...`, có vai trò riêng, audit log và design bar cho giao diện OPS.
- **Không thuộc task này:** code, migration, plan triển khai O1, quyết định nội dung chi tiết của O2/O3/O4 hoặc EPIC 21.
- **Liên quan:** [UI/UX audit và design system](../../design/2026-10-04-ui-audit-and-redesign.md), [ADR-002](../../adr/ADR-002-auth-magic-link.md), [ADR-003](../../adr/ADR-003-i18n.md), [ADR-010](../../adr/ADR-010-ops-console.md).

## 1. Mục tiêu và ranh giới milestone

Ops là workspace cho người xử lý hàng ngày. Màn hình phải đưa việc cần làm, trạng thái và bước kế tiếp lên trước; không biến console thành landing page hoặc một bảng số liệu trang trí.

Phạm vi theo đợt:

| Đợt | Phạm vi trong console | Ranh giới |
|---|---|---|
| O1 | Shell `/ops`, menu theo quyền, các queue Marketplace/Inbox hiện có, Users, Team & roles, Audit log, chuyển link legacy | Chưa có KPI và system health; chưa tạo các màn hình Content/Monetization/Feature flags nếu module chưa sẵn sàng |
| O2 | Toàn bộ thước đo và phần sức khỏe hệ thống của Overview | Phải định nghĩa nguồn dữ liệu, mốc thời gian và trạng thái stale trước khi hiển thị |
| O3 | Content & marketing | Menu ẩn cho tới khi ít nhất một route thật đã được đăng ký và có quyền tương ứng |
| O4 | Feature flags khi phần O4 sẵn sàng | EPIC 21 có thể sở hữu thêm cờ; phải gộp vào màn hình duy nhất theo quyền |
| EPIC 21 | Monetization, gồm flags/merchants khi đã có route Ops thật | Tạm thời chỉ Owner được thao tác; không hiển thị link placeholder |

Sau khi các quyết định còn mở ở mục 9 được chốt, Reviewer viết plan O1. Spec này chưa phải implementation plan.

## 2. Menu và IA

### 2.1 Nguyên tắc menu

- Sidebar chỉ render mục có route thật, đã đăng ký và người dùng hiện tại có quyền. Mục chưa làm được **ẩn hoàn toàn**, không để link chết, trang “coming soon” hoặc nút không có hành động.
- Quyền được kiểm tra ở server cho mỗi request. Việc ẩn mục chỉ là UX; không phải cơ chế bảo mật.
- Tên route canonical là tiếng Anh dưới `/ops`. Không tạo thêm `/vi/ops`, `/zh-hans/ops` hoặc `/zh-hant/ops`.
- Feature-gated menu (Content & marketing, Monetization, Feature flags) chỉ hiện khi module đã được bật và route đã có. Nếu cờ hoặc module không đọc được, coi như chưa sẵn sàng và ẩn mục.

### 2.2 Cấu trúc sidebar

| Nhóm / mục | Route mục tiêu | Nội dung và ranh giới |
|---|---|---|
| **Overview** | `/ops` | Queue: builder chờ duyệt, product đang review, feedback mới, request chờ ghép, Inquiry quá hạn. KPI và system health chỉ làm ở O2. |
| **Marketplace** | nhóm | Không phải một link giả; nhóm mở các mục con đã sẵn sàng. |
| ↳ Builders | `/ops/marketplace/builders` | Duyệt và quản lý builder theo quyền. |
| ↳ Products | `/ops/marketplace/products` | Hàng product cần review và các trạng thái đã có trong nghiệp vụ. |
| ↳ Inquiries | `/ops/marketplace/inquiries` | Theo dõi và xử lý Inquiry theo quyền. |
| ↳ Requests | `/ops/marketplace/requests` | Hàng request, ghép builder, kết thúc theo state machine hiện có. |
| ↳ Invites | `/ops/marketplace/invites` | Invite quản trị hiện có, chỉ hiện khi route thật đã chuyển. |
| **People** | nhóm | Nhóm người dùng và quyền. |
| ↳ Users | `/ops/people/users` | Người dùng; quyền thao tác theo role matrix. |
| ↳ Team & roles | `/ops/people/team` | Chỉ Owner. Quản lý thành viên Ops, không phải danh bạ marketplace. |
| **Inbox** | nhóm | Hộp việc liên quan đến phản hồi. |
| ↳ Feedback | `/ops/inbox/feedback` | Feedback mới và xử lý theo quyền. |
| **Content & marketing** | `/ops/content` và route con khi O3 có thật | Ẩn trước O3; Owner và Content có thể vào, Viewer chỉ xem khi route đã có. |
| **Monetization** | `/ops/monetization` và route con khi EPIC 21 có thật | Ẩn trước EPIC 21; tạm thời chỉ Owner được thao tác. |
| **Settings** | nhóm | Audit log là ngoại lệ đọc được bởi mọi role; mục cài đặt thay đổi vẫn Owner-only. |
| ↳ Audit log | `/ops/settings/audit-log` | Chỉ đọc; mọi role trong bảng quyền được xem. |
| ↳ Feature flags | `/ops/settings/feature-flags` | O4/EPIC 21; chỉ hiện khi route thật có, Owner thao tác. |

Overview không hiển thị biểu đồ, thước đo tổng hợp hoặc health card trong O1. Những phần đó thuộc O2 và phải dựa trên dữ liệu thật. Queue có thể có số lượng chờ để định hướng việc xử lý, nhưng số lượng đó không được trình bày như KPI hoặc health score.

Trạng thái “Inquiry quá hạn” dùng đúng luật và mốc hiện có của M5/M6. O1 không tự đặt SLA hay deadline mới chỉ để tạo một cảnh báo đẹp trên dashboard.

## 3. Vai trò và quyền

### 3.1 Ma trận quyền

| Khu vực / hành động | Owner | Operator | Content | Viewer |
|---|---:|---:|---:|---:|
| Overview, Audit log (xem) | ✓ | ✓ | ✓ | ✓ |
| Marketplace, Users, Feedback (thao tác) | ✓ | ✓ | – | chỉ xem |
| Content & marketing | ✓ | – | ✓ | chỉ xem |
| Team & roles, Settings (thao tác/cài đặt) | ✓ | – | – | – |

“Audit log (xem)” là ngoại lệ của nhóm Settings: Content và Viewer được đọc audit log, nhưng không được đổi Feature flags hay bất kỳ cài đặt nào. Content chỉ được thấy trên Overview các số đếm aggregate an toàn và freshness; không được thấy PII, dòng chi tiết, entity ID hoặc link vào Marketplace, Users hay Feedback. Viewer được đọc các màn hình Marketplace/Feedback đã được cấp route nhưng không thấy form hoặc hành động thay đổi.

Owner trong thiết kế quyền là Owner gốc đến từ `ADMIN_EMAILS`. Chỉ Owner gốc được quản lý thành viên và cấp các role `Operator`, `Content`, `Viewer`; UI không có thao tác cấp role Owner. Monetization tạm thời Owner-only, kể cả xem và thao tác, cho tới khi có quyết định EPIC 21 khác.

### 3.2 Nguồn sự thật và kiểm tra mỗi request

- `ADMIN_EMAILS` luôn là danh sách Owner gốc. Một email trong danh sách này không thể bị hạ role hoặc xóa khỏi Ops bằng UI hay POST giả mạo.
- User phải tồn tại và có trạng thái `active` mới có quyền Ops. User bị `suspended` mất quyền Ops ngay lập tức, kể cả khi email nằm trong `ADMIN_EMAILS`; việc mở khóa sau đó khôi phục quyền theo cấu hình Owner gốc hoặc membership hiện tại.
- Mọi GET, POST, route hành động, route legacy và route feature-gated đều resolve user active + role ở server trong request đó. Không dựa vào role đã render trong session, menu, hidden input hoặc cache của trình duyệt.
- Ops resolver không dùng `users.is_admin` cũ làm nguồn quyền thay cho `ADMIN_EMAILS` và `ops_members`.
- `requireAdmin` cũ không được coi là đủ cho Ops nếu nó redirect người chưa đăng nhập hoặc trả 403 cho người không có quyền. Guard Ops phải có hợp đồng 404 được mô tả ở mục 5.
- Operator không được suspend root Owner. Server phải từ chối cả request hợp lệ sai role lẫn request đã sửa form/URL. Các user khác vẫn chịu quyền Users theo ma trận.

### 3.3 Dữ liệu membership

Bảng hiện hành đề xuất là `ops_members`:

| Cột | Ý nghĩa |
|---|---|
| `user_id` | FK tới `users`, duy nhất cho membership đang có |
| `role` | `owner`, `operator`, `content` hoặc `viewer`; `owner` chỉ hiệu lực khi email đồng thời nằm trong `ADMIN_EMAILS`, và không do UI cấp |
| `granted_by` | User Owner đã cấp hoặc thay đổi membership |
| `granted_at` | Thời điểm cấp role hiện tại |
| `updated_at` | Thời điểm role hoặc membership thay đổi lần cuối |

Owner nhập email của thành viên. Người đó vẫn đăng nhập bằng magic link như bình thường. Email phải được chuẩn hóa theo quy tắc identity hiện có. Việc nhập email tạo một ý định chờ, không tạo quyền ngay và không chứng minh người đang dùng email đó.

Schema được khuyến nghị cho ý định chờ là `ops_member_invites` riêng, có email chuẩn hóa, role được cấp, Owner tạo, thời điểm tạo/hết hạn/hủy và user đã nhận sau khi xác minh. Thời hạn cụ thể là quyết định của plan O1; không suy ra từ các deadline Marketplace. Khi magic link xác minh thành công với email khớp, trong một transaction tạo hoặc cập nhật `ops_members`, đánh dấu ý định đã nhận và ghi audit. Trước thời điểm đó không có row `ops_members` có hiệu lực và không có quyền Ops.

Không ghi raw magic-link token, session cookie hoặc secret vào bảng này hay audit. Job dọn user chưa xác nhận phải xử lý ý định chờ theo trạng thái hết hạn/hủy, không được âm thầm xóa một membership đã được xác minh.

### 3.4 Thay đổi quyền

- Grant, đổi role, hủy membership, mời chờ, nhận mời, hết hạn mời và các lần từ chối do bảo vệ root đều tạo audit event.
- Mutation membership và audit tương ứng phải nguyên tử trong cùng transaction/batch. Nếu audit không ghi được thì thay đổi quyền không được coi là thành công.
- UI phải hiển thị role hiện tại, ai cấp, khi nào cấp và dấu khóa cho Owner gốc. Không cho sửa hoặc xóa dòng root Owner.
- Thao tác suspend/unsuspend user cũng phải cập nhật audit và hiệu lực authorization được tính ngay ở request kế tiếp.

## 4. Audit log

Audit log là màn hình chỉ đọc tại `/ops/settings/audit-log`. Người dùng có role được xem có thể lọc theo:

- người thao tác;
- đối tượng (`entity`/`entity_id`);
- hành động;
- khoảng ngày.

Bộ lọc phải thể hiện trong URL để bookmark/back giữ được ngữ cảnh. Pagination và sorting chỉ hiển thị nếu query backend có hỗ trợ; không làm sorting giả ở client và không hứa một filter chưa có query tương ứng.

Projection an toàn tối thiểu gồm `created_at`, `actor_user_id`, `action`, `entity`, `entity_id`. Không render raw `audit_log.data`, email riêng tư, nội dung Inquiry/Feedback, magic-link token, session identifier, API key hay secret. Chỉ được thêm label/display name đã được duyệt trong chính sách field visibility; row không được link tới detail mà role hiện tại không được phép xem.

O1 bắt buộc ghi audit nguyên tử cho grant/change/remove membership và lifecycle của ý định chờ. Audit hiện có của suspend/unsuspend, Marketplace, Feedback, Content, Monetization, Feature flags, login, revoke session hoặc invite được giữ và hiển thị qua projection an toàn khi đã tồn tại; O1 không mở rộng thành việc retrofit atomic audit cho toàn bộ mutation legacy. Root-protection denial không làm thay đổi dữ liệu, nên security audit record là tùy chọn của implementation.

Projection tối thiểu ở trên là mặc định đủ để bắt đầu O1. Mọi field visibility mở rộng, retention hoặc dữ liệu nhạy cảm mới phải có approval riêng trước khi thêm; không tự mở rộng projection vì module mới tạo payload.

## 5. Bảo vệ và hợp đồng HTTP

- Mọi response của `/ops` đều có `Cache-Control: no-store` và chỉ thị noindex (`X-Robots-Tag: noindex, nofollow`; trang HTML đồng thời có meta robots). Điều này áp dụng cho thành công, lỗi, denied và 404.
- `robots.txt` chặn `/ops` và `/ops/` (và các biến thể canonical cần thiết). Việc chặn crawler không thay thế authorization.
- Người chưa đăng nhập, user `suspended`, user không có membership hoặc role không đủ đều nhận 404 không phân biệt. Body/status không được nói rằng trang Ops tồn tại, không redirect về `/login`, không trả 403 tiết lộ route.
- Origin check hiện tại giữ nguyên cho mọi mutation Ops. Kiểm tra này chạy ở server trước khi thay đổi dữ liệu; không thay bằng hidden field hoặc kiểm tra client.
- Mỗi request phải re-check user active và capability. POST bị forge tới route không có trong sidebar vẫn phải bị chặn với cùng hợp đồng 404 và no-store/noindex.
- Không log secret trong lỗi, audit, redirect hoặc HTML. Không đưa token magic link/session cookie vào query mới.

### 5.1 Chuyển hướng legacy an toàn

Các link `/admin/...` cũ vẫn chạy nhờ mapping sang route canonical `/ops/...`, gồm cả path con:

| Legacy | Canonical |
|---|---|
| `/admin`, `/{locale}/admin` | `/ops` |
| `/admin/builders` | `/ops/marketplace/builders` |
| `/admin/products` | `/ops/marketplace/products` |
| `/admin/inquiries` | `/ops/marketplace/inquiries` |
| `/admin/requests` | `/ops/marketplace/requests` |
| `/admin/invites` | `/ops/marketplace/invites` |
| `/admin/users` | `/ops/people/users` |
| `/admin/feedback` | `/ops/inbox/feedback` |
| `/admin/flags` | `/ops/settings/feature-flags` khi O4/EPIC 21 đã có |
| `/admin/merchants` | `/ops/monetization/merchants` khi EPIC 21 đã có |

Locale prefix cũ (`/vi/admin`, `/zh-hans/admin`, `/zh-hant/admin`) cũng redirect về canonical English `/ops`; không tạo Ops locale prefix. Redirect GET chỉ giữ query parameter đã allowlist cho màn hình đích (`status`, `view`, `page`, `q` hoặc tham số đã được route đó công bố), bỏ tham số lạ và không nhận URL đích từ user. Không có open redirect.

POST legacy không được 301/302 mù. Ưu tiên internal delegation vào cùng handler sau khi kiểm auth, capability và Origin. Nếu bắt buộc redirect, chỉ dùng 307/308 cho mapping tĩnh đã được test, giữ method/body, chạy lại mọi kiểm tra và không cho phép mapping động. Redirect thành công sau mutation phải có đích canonical cố định.

Email mới dùng canonical `/ops` và path con. Email cũ được hỗ trợ qua mapping trên; link không được bỏ qua kiểm role chỉ vì nó được tạo từ trước.

## 6. Chuyển đổi và phối hợp module

- Trang admin cũ được render/di chuyển dưới `/ops/...` bằng tiếng Anh. Các path admin cũ chỉ còn vai trò compatibility mapping.
- `/ops` là không gian canonical. VNX.SI không hứa duy trì một UI song song ở `/admin` sau thời gian chuyển đổi; compatibility route phải redirect hoặc delegate an toàn.
- EPIC 21 session `vnxsi-93` sẽ đặt các màn hình monetization của họ (flags, merchants) dưới `/ops`. Nếu merge sau Ops, hai bên gộp theo route/capability mapping ở bảng legacy, không tạo sidebar trùng hoặc link chết.
- Ops dùng `t()` cho mọi chuỗi giao diện. Vì canonical Ops hiển thị English, route dùng locale `en`; để giữ quy tắc AGENTS và parity hiện có, key vẫn phải có trong cả bốn locale file cho tới khi Owner đổi chính sách i18n. Không tạo key hard-code trong JSX.

## 7. Quality bar cho UI OPS chuyên nghiệp

“Chuyên nghiệp chuẩn OPS” ở đây là một tiêu chí nghiệm thu đo được về khả năng xử lý, độ rõ và độ tin cậy. Đây không phải chứng nhận ngành hay tuyên bố rằng VNX.SI đã đạt một chuẩn phổ quát.

### 7.1 Nguyên tắc tham khảo và cách áp dụng

Các nguồn sau được dùng để lấy nguyên tắc, không sao chép thương hiệu, màu sắc hay layout:

- [Grafana dashboard best practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/): một màn hình phải trả lời câu hỏi vận hành, có thứ bậc và giảm cognitive load. VNX áp dụng bằng queue và drill-down trước; health metrics chỉ vào O2, có nguồn/mốc rõ.
- [PagerDuty incidents](https://support.pagerduty.com/main/docs/incidents): người xử lý cần thấy state, timeline, actor và hành động kế tiếp. VNX áp dụng vào detail/action/audit flow cho builder, product, request, feedback và membership.
- [Carbon data table specifications](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/specifications): bảng dày cần header, cột, trạng thái và row action rõ ràng, có khả năng đọc bằng bàn phím. VNX áp dụng các nguyên tắc bảng accessible với token và dữ liệu riêng của VNX.

Ops không dùng hero marketing, CTA chuyển đổi, testimonial, chart trang trí, background animation hoặc pattern marketplace public. Mục tiêu là quyết định nhanh và thao tác an toàn.

### 7.2 Shell và design system

- Desktop có sidebar ổn định khoảng `240px`, vùng nội dung có khoảng thở nhưng ưu tiên mật độ thông tin. Header có breadcrumb, page title, role hiện tại và environment nếu runtime cung cấp giá trị thật.
- Dùng lại token VNX trong [UI audit](../../design/2026-10-04-ui-audit-and-redesign.md): màu semantic sáng/tối, spacing bội số 4, radius/shadow hiện có, trạng thái `success/warning/error/info`. Không tạo bảng màu Ops tách rời nếu không có lý do accessibility.
- Dùng font tự host đã được duyệt: Space Grotesk cho title, Be Vietnam Pro cho nội dung, JetBrains Mono cho label/mã/số. Số vận hành dùng tabular numerals khi cần so sánh cột.
- Navigation có trạng thái hiện tại rõ, nhóm có heading, focus-visible và hit area tối thiểu 44px. Ở màn hình hẹp sidebar chuyển thành control có nhãn; không làm mất route hoặc context.
- Sidebar không có mục chưa làm. Không dùng icon nhiều màu hoặc animation để bù cho dữ liệu thiếu. Icon trạng thái chỉ hỗ trợ chữ, không thay chữ.

### 7.3 Data-first queues và flow xử lý

- Overview mở ra bằng các queue cần xử lý. Mỗi queue cho biết loại việc, trạng thái bằng chữ, tuổi hoặc thời điểm cập nhật, dữ liệu mới nhất lúc nào và link tới danh sách có quyền tương ứng.
- Danh sách dùng bảng dày, header rõ, cột chính ổn định, row action không gây nhầm. Mobile có cuộn ngang hoặc bố cục xếp lại nhưng không cắt mất trạng thái/hành động.
- Bộ lọc được gắn nhãn, giá trị hợp lệ allowlist và giữ trong URL. Pagination/sorting chỉ có khi backend hỗ trợ và phải giữ semantics query; không hiển thị control giả.
- Luồng chuẩn là `list → detail → action → result → audit`. Detail cho biết state hiện tại, lần thay đổi gần nhất, actor nếu được phép, hành động hợp lệ và link quay lại giữ bộ lọc.
- Action thành công/lỗi phải báo cho từng thao tác. Nút submit bị khóa trong lúc gửi và server phải chống gửi lặp bằng compare-and-set/idempotency phù hợp.
- Suspend, remove, reject, đổi role và mutation nguy hiểm khác cần confirmation nêu rõ đối tượng, tác động và lý do bắt buộc nếu nghiệp vụ yêu cầu. Confirmation không thay thế kiểm tra quyền ở server.

### 7.4 Trạng thái và độ tin cậy dữ liệu

- `loading`, `empty`, `error`, `stale` và `success` có layout/nhãn riêng. Error không đổ dữ liệu giả hoặc chi tiết bí mật.
- “Không có dòng dữ liệu” khác “giá trị bằng 0”; không hiển thị empty như số 0 và không hiển thị số 0 khi query lỗi hoặc chưa có dữ liệu.
- Mỗi queue/metric có thời điểm cập nhật hoặc nguồn dữ liệu khi thông tin đó có ý nghĩa. Dữ liệu stale phải được đánh dấu là stale, không làm người vận hành tưởng là realtime.
- Status luôn có text và icon; màu chỉ là tín hiệu phụ. `pending`, `in_review`, `overdue`, `suspended`, `handled` phải đọc được khi grayscale.
- Không đưa metric, health score hay chart vào O1 chỉ để lấp khoảng trống. O2 phải định nghĩa metric, cửa sổ dữ liệu, cách tính và behavior khi thiếu dữ liệu trước visual review.

### 7.5 Accessibility và responsive acceptance

Mỗi màn hình O1 phải vượt các cổng sau ở dữ liệu dài, nhiều dòng và lỗi mạng:

- thao tác được bằng bàn phím; thứ tự tab, landmark, heading, table header và focus-visible rõ;
- contrast text tối thiểu 4.5:1; text lớn và UI boundary/focus tối thiểu 3:1; không dùng màu làm tín hiệu duy nhất;
- focus không bị che bởi sticky header/sidebar; control và target chính tối thiểu 44px;
- không mất chức năng ở viewport `375px`, `768px`, `1280px`, `1440px`, và khi zoom 200%;
- `prefers-reduced-motion: reduce` tắt chuyển động không cần thiết. Ops không có decorative animation hoặc auto-rotating panel;
- loading/submit/error được thông báo bằng semantics phù hợp (`role`, live region khi cần), không chỉ đổi màu.

### 7.6 Visual review trước code

Trước khi implement UI O1 cần có mockup hoặc prototype cho shell, Overview queue, một list/detail/action flow, audit log và mobile behavior. Reviewer kiểm tối thiểu:

- light/dark theo token VNX;
- viewport `375/768/1280/1440` và zoom 200%;
- keyboard/focus, trạng thái loading/empty/error/stale;
- role matrix: menu được ẩn đúng, Viewer không thấy action, Content không thấy Marketplace action;
- không có link chết, hero marketing hoặc chart không có dữ liệu.

Visual review là cổng chất lượng trước code, không phải lý do để dựng các component hoặc route chưa được spec.

## 8. Tiêu chí nghiệm thu của spec

Plan O1 sau này phải chứng minh ít nhất các behavior sau bằng test route/data hoặc kiểm tra UI phù hợp:

1. Sidebar không render mục chưa có route thật hoặc feature chưa sẵn sàng.
2. Ma trận Owner/Operator/Content/Viewer đúng cho Overview, Marketplace, Users, Feedback, Content, Team & roles, Audit log và Settings.
3. `ADMIN_EMAILS` root Owner không bị demote/remove; Operator không suspend được root Owner; user suspended mất Ops ngay.
4. Membership chờ chỉ kích hoạt sau magic-link verification khớp email chuẩn hóa; grant/change/remove có audit nguyên tử.
5. Audit log read-only, lọc đúng actor/entity/action/date, chỉ trả projection an toàn và không link tới detail trái quyền.
6. Mọi `/ops` response và denied response có no-store/noindex; không role/unauth nhận 404; mutation có Origin check.
7. Legacy GET mapping giữ đúng query allowlist; legacy POST không dùng 301/302 mù và vẫn chạy đủ auth/capability/Origin.
8. Email mới trỏ canonical `/ops`; link cũ tới được route tương đương hoặc trả 404 kín đáo nếu module đã bị rút.
9. UI gates ở mục 7 đạt trước khi gọi O1 hoàn tất.

## 9. Quyết định đã ghi nhận và việc còn mở

Đã chốt cho thiết kế này:

- chỉ `ADMIN_EMAILS` root Owner có hiệu lực Owner; UI chỉ cấp Operator, Content, Viewer;
- chỉ Owner quản lý Team & roles;
- Operator không suspend được root Owner;
- monetization tạm Owner-only;
- email thành viên chưa có user chỉ là permission intent; chỉ activate sau khi magic link xác minh email chuẩn hóa khớp; dùng bảng pending riêng là hướng khuyến nghị;
- user suspended mất Ops ngay, kể cả root Owner; mở khóa có thể khôi phục quyền theo cấu hình hiện hành;
- canonical Ops là English và route không có locale prefix; vẫn dùng `t()` và giữ parity key bốn locale theo chính sách hiện tại.

**Cần chốt trước O1:**

- mapping cuối cùng của các route admin chưa có trong bảng khi module tương ứng chuyển, kèm allowlist query và test POST nếu còn form legacy;

Projection audit tối thiểu ở mục 4 là mặc định cho O1. Field visibility/retention mở rộng và dữ liệu nhạy cảm mới cần approval riêng trước khi thêm, nhưng không chặn O1 khi UI giữ projection tối thiểu.

**Để dành cho O2:**

- metric definitions, cửa sổ dữ liệu, nguồn và freshness contract của toàn bộ thước đo/system health. Không thêm metric vào O1.
