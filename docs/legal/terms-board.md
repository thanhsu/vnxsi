# Terms of Service — phiên bản board (bảng nhu cầu công khai, EPIC 27; câu chữ Owner đã duyệt 2026-10-07, EN và VI)

- **Trạng thái:** APPROVED (Owner 2026-10-07, EN và VI). Câu chữ thêm của bảng công khai chép nguyên văn từ phụ lục `docs/superpowers/specs/2026-10-07-vnxsi-public-request-board-addendum.md` §12.3 (EN) và §12.6 (VI), không dịch lại, không sửa chữ. Phần còn lại giống hệt `terms.md` hiện tại, kể cả đoạn mục 4 về tài khoản liên kết (VNX-2607, ADR-013). Không chép hai mục ghi chú và phụ lục ADR-012 nằm sau phần `## VI` của `terms.md`. Không phải tư vấn pháp lý; Q16: cần người có chuyên môn đọc lại trước khi bật cờ.
- **Khi nào hiện:** `/terms` hiện bản này từ `REQUEST_BOARD_GO_LIVE` − 14 ngày UTC, và từ đó về sau luôn hiện (`domain/legal-versions.ts` `termsVersionOf`, `legal/select.ts`); trước đó hiện `terms.md`. Ngày "Last updated" của bản này là `REQUEST_BOARD_GO_LIVE`. `terms.md` **không** chứa câu chữ board.
- **Hai phiên bản:** cho tới task dọn, mọi thay đổi Terms phải sửa cả `terms.md` và tệp này, cùng cả bốn hằng số (`termsEn`, `termsVi`, `termsEnBoard`, `termsViBoard`) trong `src/legal/content.ts`.
- **Thay đổi so với `terms.md`:** mục 5 thêm một gạch cuối; mục 6 thêm đoạn "Public requests." / "Nhu cầu công khai." (đứng sau đoạn cũ); mục 7 thêm một gạch cuối. Không có dòng nào của `terms.md` bị thay (chỉ dòng "Last updated").
- **Đối chiếu code:** hằng số `termsEnBoard`, `termsViBoard` trong `BOARD_LEGAL.terms`; test `test/legal/content.test.ts`, `test/legal/request-board-versions.test.ts`, `test/config/wrangler-guard.test.ts` (tập cha của `terms.md`, danh sách `REPLACED_TERMS`).

---

## EN

### Terms of Service

Last updated: {date}

**1. About these terms**
These terms apply when you use vnx.si ("VNX.SI", "we"). By using the site you agree to them. If you do not agree, please do not use the site. Questions: contact@vnx.si.

**2. What VNX.SI is**
VNX.SI is a marketplace where builders list products built with AI, and people looking for software can find those products and the builders who made them. VNX.SI connects the two sides. We are not a party to any agreement between a client and a builder, and we do not currently process payments.

**3. Who can use VNX.SI**
- You must be at least 16 to leave your email on our waitlist.
- You must be at least 18 to create a builder profile, list a product, or agree a purchase or project with another user.
- You must give a correct email address and keep access to it, because we sign you in by email link.

**4. Your account**
You sign in with a one-time link sent to your email. Once signed in with the email link, you can link a Google, GitHub or LinkedIn account and use it to sign in too. Keep your email account and any linked accounts secure; anyone who can use them can sign in as you. We email you whenever an account is linked or unlinked. Tell us at contact@vnx.si if you think someone else has used your account.

**5. Builders and listings**
If you list a product or create a builder profile:
- The information you publish must be true and you must have the right to publish it, including images, names and links.
- You keep ownership of your content. You give VNX.SI a non-exclusive, worldwide, royalty-free permission to host, display, translate the interface around, and link to that content on vnx.si and when sharing vnx.si pages, for as long as it is published and for a reasonable time after you remove it.
- We review profiles and products before they become public and may ask for changes, refuse, hide or remove them.
- A badge means only what it says (for example, "Demo verified" means we opened the demo and it worked at that time). A badge is not a warranty, an endorsement, or a guarantee of quality, security or fitness for a purpose.
- If you tell us you are interested in a public request, what you write must be true. Use the request board only to find work through VNX.SI.

**6. Clients**
When you contact a builder or buy from, hire or agree a project with a builder, the agreement is between you and the builder. Check the product, price, licence and terms yourself before you agree.

**Public requests.** You can choose to show a request on our public request board. If you do: do not include other people's personal data, contact details, or information you are not allowed to share; we review the request before it is shown and may edit it, refuse it or remove it at any time; you can remove it at any time from your account page. A builder telling us they are interested does not create any agreement, and we still choose which builders to invite.

**7. What you must not do**
- Publish anything false, misleading, illegal, or that infringes someone else's rights.
- Upload malware, or link to sites that harm visitors.
- Send spam, scrape the site at scale, or try to break, overload or get around its security.
- Pretend to be someone else, or use another person's account.
- Try to change rankings, badges or statistics by fake activity.
- Try to identify the author of a public request, contact them outside VNX.SI, or copy public requests to other sites.

**8. Rankings and partner links**
Rankings on VNX.SI are never for sale. Some links to other companies' products are partner or affiliate links: if you sign up or buy through them, VNX.SI may earn a commission. Pages with such links say so. A commission never changes how products are ranked.

**9. Suspension and removal**
We may suspend an account, or hide or remove content, if it breaks these terms, puts other users at risk, or if the law requires it. Where reasonable we will tell you why.

**10. No warranty**
VNX.SI is provided "as is". We do our best to keep it available and accurate, but we do not promise that it will be uninterrupted, error-free, or that any product or builder listed on it is suitable for you.

**11. Limitation of liability**
To the extent the law allows, VNX.SI is not liable for indirect or consequential loss, for loss of profit or data, or for anything that happens in an agreement between a client and a builder. Nothing in these terms limits liability that cannot be limited by law.

**12. Changes**
We may update these terms. We will change the "Last updated" date and, for important changes, tell signed-in users before the changes apply. If you keep using the site after that, the new terms apply.

**13. Governing law**
These terms are governed by the law of Vietnam. Disputes will be handled by the competent courts of Vietnam, unless the law where you live gives you the right to bring a claim there.

**14. Language**
These terms are written in English. If a translation differs from the English version, the English version applies.

---

## VI

### Điều khoản sử dụng

Cập nhật lần cuối: {date}

**1. Về điều khoản này**
Điều khoản này áp dụng khi bạn dùng vnx.si ("VNX.SI", "chúng tôi"). Khi dùng trang, bạn đồng ý với các điều khoản này. Nếu không đồng ý, vui lòng không dùng trang. Câu hỏi: contact@vnx.si.

**2. VNX.SI là gì**
VNX.SI là chợ nơi builder đăng sản phẩm được xây bằng AI, và người cần phần mềm tìm được sản phẩm đó cùng người đã xây nó. VNX.SI kết nối hai bên. Chúng tôi không phải một bên trong bất kỳ thỏa thuận nào giữa client và builder, và hiện chưa xử lý thanh toán.

**3. Ai được dùng VNX.SI**
- Bạn phải từ 16 tuổi trở lên để để lại email trong danh sách chờ.
- Bạn phải từ 18 tuổi trở lên để tạo hồ sơ builder, đăng sản phẩm, hoặc thỏa thuận mua bán hay dự án với người dùng khác.
- Bạn phải dùng email đúng và giữ quyền truy cập email đó, vì chúng tôi đăng nhập bằng link gửi qua email.

**4. Tài khoản của bạn**
Bạn đăng nhập bằng link dùng một lần gửi tới email. Sau khi đăng nhập bằng link qua email, bạn có thể liên kết tài khoản Google, GitHub hoặc LinkedIn và dùng nó để đăng nhập. Hãy giữ an toàn hộp thư và các tài khoản đã liên kết; ai dùng được chúng đều có thể đăng nhập như bạn. Chúng tôi gửi email cho bạn mỗi khi có tài khoản được liên kết hoặc hủy liên kết. Báo cho chúng tôi qua contact@vnx.si nếu bạn nghĩ có người khác đã dùng tài khoản của bạn.

**5. Builder và listing**
Nếu bạn đăng sản phẩm hoặc tạo hồ sơ builder:
- Thông tin bạn công khai phải đúng sự thật và bạn phải có quyền công khai nó, kể cả hình ảnh, tên và đường link.
- Bạn vẫn sở hữu nội dung của mình. Bạn cho VNX.SI quyền không độc quyền, trên toàn thế giới, không thu phí, để lưu trữ, hiển thị, dịch phần giao diện xung quanh, và dẫn link tới nội dung đó trên vnx.si và khi chia sẻ trang vnx.si, trong thời gian nội dung được công khai và một khoảng thời gian hợp lý sau khi bạn gỡ.
- Chúng tôi duyệt hồ sơ và sản phẩm trước khi công khai, và có thể yêu cầu sửa, từ chối, ẩn hoặc gỡ.
- Huy hiệu chỉ có nghĩa đúng như nội dung của nó (ví dụ "Demo verified" nghĩa là chúng tôi đã mở demo và nó chạy vào thời điểm kiểm). Huy hiệu không phải bảo hành, không phải lời bảo chứng, và không bảo đảm chất lượng, bảo mật hay sự phù hợp cho một mục đích.
- Nếu bạn báo với chúng tôi rằng bạn quan tâm tới một nhu cầu công khai, những gì bạn viết phải đúng sự thật. Chỉ dùng bảng nhu cầu để tìm việc thông qua VNX.SI.

**6. Client**
Khi bạn liên hệ builder, mua, thuê hoặc thỏa thuận dự án với builder, thỏa thuận đó là giữa bạn và builder. Hãy tự kiểm sản phẩm, giá, giấy phép và điều khoản trước khi đồng ý.

**Nhu cầu công khai.** Bạn có thể chọn hiện một nhu cầu trên bảng nhu cầu công khai. Nếu bạn làm vậy: không đưa dữ liệu cá nhân của người khác, thông tin liên lạc, hay thông tin bạn không được phép chia sẻ; chúng tôi xem nhu cầu trước khi hiện và có thể sửa, từ chối hoặc gỡ nó bất cứ lúc nào; bạn có thể gỡ nó bất cứ lúc nào từ trang tài khoản. Việc một builder báo rằng họ quan tâm không tạo ra thỏa thuận nào, và chúng tôi vẫn chọn mời builder nào.

**7. Những điều bạn không được làm**
- Đăng nội dung sai sự thật, gây hiểu lầm, trái pháp luật, hoặc xâm phạm quyền của người khác.
- Tải lên mã độc, hoặc dẫn link tới trang gây hại cho người xem.
- Gửi spam, thu thập dữ liệu trang ở quy mô lớn, hoặc tìm cách phá, làm quá tải hay vượt qua cơ chế bảo mật.
- Giả làm người khác, hoặc dùng tài khoản của người khác.
- Tìm cách thay đổi thứ hạng, huy hiệu hay số liệu bằng hoạt động giả.
- Tìm cách nhận ra người đăng một nhu cầu công khai, liên hệ họ bên ngoài VNX.SI, hoặc chép nhu cầu công khai sang trang khác.

**8. Thứ hạng và link partner**
Thứ hạng trên VNX.SI không bao giờ được bán. Một số link tới sản phẩm của công ty khác là link partner hoặc affiliate: nếu bạn đăng ký hoặc mua qua các link đó, VNX.SI có thể nhận hoa hồng. Trang có link như vậy sẽ ghi rõ. Hoa hồng không bao giờ thay đổi cách xếp hạng sản phẩm.

**9. Tạm khóa và gỡ bỏ**
Chúng tôi có thể tạm khóa tài khoản, hoặc ẩn hay gỡ nội dung, nếu vi phạm điều khoản này, gây rủi ro cho người dùng khác, hoặc khi pháp luật yêu cầu. Khi hợp lý, chúng tôi sẽ cho bạn biết lý do.

**10. Không bảo đảm**
VNX.SI được cung cấp "nguyên trạng". Chúng tôi cố gắng giữ trang hoạt động và chính xác, nhưng không hứa trang sẽ không gián đoạn, không lỗi, hay bất kỳ sản phẩm hoặc builder nào trên trang phù hợp với bạn.

**11. Giới hạn trách nhiệm**
Trong phạm vi pháp luật cho phép, VNX.SI không chịu trách nhiệm về thiệt hại gián tiếp hoặc hệ quả, mất lợi nhuận hoặc dữ liệu, hoặc bất cứ điều gì xảy ra trong thỏa thuận giữa client và builder. Không điều nào ở đây giới hạn trách nhiệm mà pháp luật không cho phép giới hạn.

**12. Thay đổi**
Chúng tôi có thể cập nhật điều khoản này. Chúng tôi sẽ đổi ngày "Cập nhật lần cuối" và, với thay đổi quan trọng, báo cho người dùng đã đăng nhập trước khi thay đổi có hiệu lực. Nếu bạn tiếp tục dùng trang sau đó, điều khoản mới được áp dụng.

**13. Luật áp dụng**
Điều khoản này tuân theo pháp luật Việt Nam. Tranh chấp do tòa án có thẩm quyền tại Việt Nam giải quyết, trừ khi pháp luật nơi bạn sống cho bạn quyền khởi kiện ở đó.

**14. Ngôn ngữ**
Điều khoản này được viết bằng tiếng Anh. Nếu bản dịch khác bản tiếng Anh, bản tiếng Anh được áp dụng.
