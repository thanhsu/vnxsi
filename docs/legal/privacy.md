# Privacy Policy — bản nháp

- **Trạng thái:** APPROVED bởi Owner 2026-10-04 (câu chữ và số liệu). Đây là bản soạn để bắt đầu, **không phải tư vấn pháp lý**; nên nhờ người có chuyên môn đọc lại trước khi dựa vào nó.
- **Task:** VNX-0705a. Implementer chuyển nguyên văn mục EN và VI vào `src/content/legal/privacy.ts`; `zh-Hans`, `zh-Hant` hiện bản EN kèm câu "bản tiếng Anh có hiệu lực" đã dịch.
- **Nguyên tắc:** chỉ ghi điều code thật sự làm **tại thời điểm go-live**. Mỗi khi M5 (Inquiry), M6 (request), M7 (lượt xem, `/go/`), EPIC 21 (partner) thêm dữ liệu, phải cập nhật trang này trong cùng task đó.
- **Đối chiếu code (`main` tại `5363766`):** session `__Host-vnx_session` 30 ngày (`auth/sessions.ts`); link đăng nhập 15 phút (`auth/tokens.ts`); `__Host-vnx_invite` 1 giờ (`auth/invite-cookie.ts`); rate limit lưu IP thô trong khóa `login:ip:*`, `waitlist:ip:*` và hash email `login:email:*` (`routes/auth.tsx`, `routes/landing.tsx`); waitlist lưu email, `personas`, `consent_at`, `lang`, `country`, `referrer` (host), `utm_*` (`db/waitlist.ts`).
- **Điều kiện để câu về thời hạn giữ IP đúng:** cron dọn `rate_limits` (VNX-0505, M5) chạy trước go-live.
- **Owner chốt (2026-10-04):** trả lời yêu cầu trong 30 ngày; giữ waitlist tới khi chợ mở cho client cộng 12 tháng, hoặc tới khi người dùng yêu cầu xóa.

---

## EN

### Privacy Policy

Last updated: {date}

**1. Who we are**
This policy explains how VNX.SI ("we") handles personal data on vnx.si. Contact for any privacy question or request: contact@vnx.si.

**2. What we collect**
- **Account:** your email address, the display name you choose, your language, whether you are an admin, and when you last signed in.
- **Sign-in:** one-time sign-in links (stored only as a hash, valid for 15 minutes) and session records (stored only as a hash).
- **Builder profile and products:** what you enter in your profile and listings (name, headline, bio, country, skills, rates, links, product descriptions, prices, images). This content is **public** once approved.
- **Waitlist:** your email, the time you agreed to be contacted, the language of the page, your country as detected by our hosting provider, the website you came from (domain only, not the full address), and campaign tags (`utm_*`) if the link you followed had them.
- **Security:** your IP address and a hash of your email in short-lived counters that limit how often a form can be used, and a record of actions taken by admins (for example approving a profile).

We do not collect payment details. We do not use third-party analytics, advertising or tracking cookies.

**3. Why we use it**
- To sign you in and keep you signed in.
- To show builder profiles and products publicly, and to review them before they go public.
- To email you about your account, your listings, or, if you joined the waitlist, when the marketplace opens.
- To protect the site against spam and abuse.

We rely on your consent (waitlist), on what is needed to provide the service you asked for (account, listings), and on our legitimate interest in keeping the site secure.

**4. Who can see it**
- Builder profiles and approved products are public.
- Builders do not see clients' email addresses.
- Service providers process data for us: **Cloudflare** (hosting, database, file storage, security) and **Resend** (sending email). They may process data outside your country.
- We do not sell personal data. We share it with authorities only when the law requires it.

**5. Cookies**
We use only cookies that the site needs to work:
- `__Host-vnx_session`: keeps you signed in, for up to 30 days.
- `__Host-vnx_invite`: remembers a builder invite link for 1 hour.

**6. How long we keep it**
- Sign-in links: 15 minutes. Sessions: up to 30 days, or until you sign out.
- Rate-limit counters (including IP addresses): deleted regularly once they expire.
- Account, profile and listings: while your account exists. When you ask us to delete it, we delete or anonymise it, except records we must keep by law or to protect the site.
- Waitlist: until the marketplace opens to clients plus 12 months, or until you ask us to remove you.

**7. Your rights**
You can ask to see, correct, export or delete your personal data, to withdraw your consent, or to object to how we use it. Email contact@vnx.si from the address you used with us. We reply within 30 days. You can also complain to the data protection authority where you live.

**8. Security**
Sessions and sign-in links are stored only as hashes, the site is served over HTTPS only, and admin actions are logged. No system is perfectly secure; tell us at contact@vnx.si if you find a problem.

**9. Children**
VNX.SI is not for children. You must be at least 16 to join the waitlist and 18 to be a builder.

**10. Changes**
When we change this policy we update the date above. For important changes we will tell signed-in users before they apply.

**11. Language**
If a translation differs from the English version, the English version applies.

---

## VI

### Chính sách quyền riêng tư

Cập nhật lần cuối: {date}

**1. Chúng tôi là ai**
Chính sách này giải thích cách VNX.SI ("chúng tôi") xử lý dữ liệu cá nhân trên vnx.si. Liên hệ cho mọi câu hỏi hoặc yêu cầu về quyền riêng tư: contact@vnx.si.

**2. Chúng tôi thu thập gì**
- **Tài khoản:** email, tên hiển thị bạn chọn, ngôn ngữ, bạn có phải admin không, và lần đăng nhập gần nhất.
- **Đăng nhập:** link đăng nhập dùng một lần (chỉ lưu dạng hash, hiệu lực 15 phút) và bản ghi phiên đăng nhập (chỉ lưu dạng hash).
- **Hồ sơ builder và sản phẩm:** những gì bạn nhập vào hồ sơ và listing (tên, tiêu đề, giới thiệu, quốc gia, kỹ năng, mức giá, link, mô tả sản phẩm, giá, hình ảnh). Nội dung này **công khai** sau khi được duyệt.
- **Danh sách chờ:** email, thời điểm bạn đồng ý nhận liên hệ, ngôn ngữ của trang, quốc gia do nhà cung cấp hosting nhận diện, trang web bạn đến từ đó (chỉ tên miền, không phải địa chỉ đầy đủ), và thẻ chiến dịch (`utm_*`) nếu link bạn bấm có.
- **Bảo mật:** địa chỉ IP và hash email của bạn trong các bộ đếm ngắn hạn để giới hạn số lần dùng form, và bản ghi thao tác của admin (ví dụ duyệt hồ sơ).

Chúng tôi không thu thông tin thanh toán. Chúng tôi không dùng analytics, quảng cáo hay cookie theo dõi của bên thứ ba.

**3. Chúng tôi dùng để làm gì**
- Đăng nhập và giữ bạn đăng nhập.
- Hiển thị công khai hồ sơ builder và sản phẩm, và duyệt chúng trước khi công khai.
- Gửi email về tài khoản, listing của bạn, hoặc, nếu bạn vào danh sách chờ, báo khi chợ mở.
- Bảo vệ trang khỏi spam và lạm dụng.

Căn cứ của chúng tôi là sự đồng ý của bạn (danh sách chờ), nhu cầu để cung cấp dịch vụ bạn yêu cầu (tài khoản, listing), và lợi ích chính đáng trong việc giữ an toàn cho trang.

**4. Ai thấy được dữ liệu**
- Hồ sơ builder và sản phẩm đã duyệt là công khai.
- Builder không thấy email của client.
- Các nhà cung cấp dịch vụ xử lý dữ liệu thay chúng tôi: **Cloudflare** (hosting, cơ sở dữ liệu, lưu trữ file, bảo mật) và **Resend** (gửi email). Họ có thể xử lý dữ liệu ngoài quốc gia của bạn.
- Chúng tôi không bán dữ liệu cá nhân. Chúng tôi chỉ cung cấp cho cơ quan chức năng khi pháp luật yêu cầu.

**5. Cookie**
Chúng tôi chỉ dùng cookie cần thiết để trang hoạt động:
- `__Host-vnx_session`: giữ bạn đăng nhập, tối đa 30 ngày.
- `__Host-vnx_invite`: ghi nhớ link mời builder trong 1 giờ.

**6. Chúng tôi giữ bao lâu**
- Link đăng nhập: 15 phút. Phiên đăng nhập: tối đa 30 ngày, hoặc tới khi bạn đăng xuất.
- Bộ đếm giới hạn (gồm địa chỉ IP): được xóa định kỳ khi hết hạn.
- Tài khoản, hồ sơ và listing: trong thời gian tài khoản tồn tại. Khi bạn yêu cầu xóa, chúng tôi xóa hoặc ẩn danh, trừ các bản ghi phải giữ theo luật hoặc để bảo vệ trang.
- Danh sách chờ: tới khi chợ mở cho client cộng 12 tháng, hoặc tới khi bạn yêu cầu gỡ.

**7. Quyền của bạn**
Bạn có thể yêu cầu xem, sửa, xuất hoặc xóa dữ liệu cá nhân, rút lại sự đồng ý, hoặc phản đối cách chúng tôi dùng dữ liệu. Gửi email tới contact@vnx.si từ địa chỉ bạn đã dùng với chúng tôi. Chúng tôi trả lời trong 30 ngày. Bạn cũng có thể khiếu nại với cơ quan bảo vệ dữ liệu nơi bạn sống.

**8. Bảo mật**
Phiên và link đăng nhập chỉ được lưu dạng hash, trang chỉ phục vụ qua HTTPS, và thao tác của admin được ghi lại. Không hệ thống nào an toàn tuyệt đối; hãy báo cho chúng tôi qua contact@vnx.si nếu bạn phát hiện vấn đề.

**9. Trẻ em**
VNX.SI không dành cho trẻ em. Bạn phải từ 16 tuổi để vào danh sách chờ và từ 18 tuổi để làm builder.

**10. Thay đổi**
Khi thay đổi chính sách này, chúng tôi cập nhật ngày ở trên. Với thay đổi quan trọng, chúng tôi báo cho người dùng đã đăng nhập trước khi có hiệu lực.

**11. Ngôn ngữ**
Nếu bản dịch khác bản tiếng Anh, bản tiếng Anh được áp dụng.

---

## Ghi chú cho Owner

- Mục 6 và 7 có hai con số cần bạn chốt: **12 tháng** giữ waitlist sau khi chợ mở, **30 ngày** trả lời yêu cầu. Nghị định 13/2023 của Việt Nam có thời hạn riêng cho một số yêu cầu; nên hỏi người chuyên môn.
- Câu "Bộ đếm giới hạn … được xóa định kỳ" chỉ đúng khi cron VNX-0505 chạy. Không go-live trước khi có cron đó.
- Nhật ký lỗi của Workers (observability) có thể chứa đường dẫn và metadata request; đã gộp vào "Cloudflare (hosting … security)". Nếu muốn nói rõ hơn thì thêm một dòng ở mục 4.
