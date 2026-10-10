/**
 * Terms, Privacy, Media kit (VNX-0705a) and Disclosure (VNX-2104b). Plain data: no Hono, no D1.
 *
 * Copied word for word from the `## EN` and `## VI` parts of docs/legal/terms.md, privacy.md, media-kit.md and disclosure.md
 * (approved by the Owner 2026-10-04 and, for the linked-accounts text (ADR-012), 2026-10-07 (VNX-2607)); test/legal/content.test.ts compares the rendered pages with those files.
 * Change the source file first, then this file, in the same task. zh-Hans and zh-Hant show the EN text (VNX-0801 translates).
 */

/** Shown as "Last updated" on Terms and Privacy; the `{date}` of the source files. Shared: a change to either moves both. */
export const LEGAL_UPDATED_AT = "2026-10-05";

/** Text that may hold `code` and **bold**; contact@vnx.si becomes a mailto link. No other markup. */
export type Inline = string;
export type Block = { p: Inline } | { ul: Inline[] };
export type Section = { heading: string; blocks: Block[] };
export type LegalDoc = { title: string; sections: Section[] };

export type LegalPageId = "terms" | "privacy" | "mediaKit" | "disclosure";
export type LegalPage = { rest: string; dated: boolean; en: LegalDoc; vi: LegalDoc };

const termsEn: LegalDoc = {
  title: "Terms of Service",
  sections: [
    {
      heading: "1. About these terms",
      blocks: [
        { p: "These terms apply when you use vnx.si (\"VNX.SI\", \"we\"). By using the site you agree to them. If you do not agree, please do not use the site. Questions: contact@vnx.si." },
      ],
    },
    {
      heading: "2. What VNX.SI is",
      blocks: [
        { p: "VNX.SI is a marketplace where builders list products built with AI, and people looking for software can find those products and the builders who made them. VNX.SI connects the two sides. We are not a party to any agreement between a client and a builder, and we do not currently process payments." },
      ],
    },
    {
      heading: "3. Who can use VNX.SI",
      blocks: [
        {
          ul: [
            "You must be at least 16 to leave your email on our waitlist.",
            "You must be at least 18 to create a builder profile, list a product, or agree a purchase or project with another user.",
            "You must give a correct email address and keep access to it, because we sign you in by email link.",
          ],
        },
      ],
    },
    {
      heading: "4. Your account",
      blocks: [
        { p: "You sign in with a one-time link sent to your email. Once signed in with the email link, you can link a Google, GitHub or LinkedIn account and use it to sign in too. Keep your email account and any linked accounts secure; anyone who can use them can sign in as you. We email you whenever an account is linked or unlinked. Tell us at contact@vnx.si if you think someone else has used your account." },
      ],
    },
    {
      heading: "5. Builders and listings",
      blocks: [
        { p: "If you list a product or create a builder profile:" },
        {
          ul: [
            "The information you publish must be true and you must have the right to publish it, including images, names and links.",
            "You keep ownership of your content. You give VNX.SI a non-exclusive, worldwide, royalty-free permission to host, display, translate the interface around, and link to that content on vnx.si and when sharing vnx.si pages, for as long as it is published and for a reasonable time after you remove it.",
            "We review profiles and products before they become public and may ask for changes, refuse, hide or remove them.",
            "A badge means only what it says (for example, \"Demo verified\" means we opened the demo and it worked at that time). A badge is not a warranty, an endorsement, or a guarantee of quality, security or fitness for a purpose.",
          ],
        },
      ],
    },
    {
      heading: "6. Clients",
      blocks: [
        { p: "When you contact a builder or buy from, hire or agree a project with a builder, the agreement is between you and the builder. Check the product, price, licence and terms yourself before you agree." },
      ],
    },
    {
      heading: "7. What you must not do",
      blocks: [
        {
          ul: [
            "Publish anything false, misleading, illegal, or that infringes someone else's rights.",
            "Upload malware, or link to sites that harm visitors.",
            "Send spam, scrape the site at scale, or try to break, overload or get around its security.",
            "Pretend to be someone else, or use another person's account.",
            "Try to change rankings, badges or statistics by fake activity.",
          ],
        },
      ],
    },
    {
      heading: "8. Rankings and partner links",
      blocks: [
        { p: "Rankings on VNX.SI are never for sale. Some links to other companies' products are partner or affiliate links: if you sign up or buy through them, VNX.SI may earn a commission. Pages with such links say so. A commission never changes how products are ranked." },
      ],
    },
    {
      heading: "9. Suspension and removal",
      blocks: [
        { p: "We may suspend an account, or hide or remove content, if it breaks these terms, puts other users at risk, or if the law requires it. Where reasonable we will tell you why." },
      ],
    },
    {
      heading: "10. No warranty",
      blocks: [
        { p: "VNX.SI is provided \"as is\". We do our best to keep it available and accurate, but we do not promise that it will be uninterrupted, error-free, or that any product or builder listed on it is suitable for you." },
      ],
    },
    {
      heading: "11. Limitation of liability",
      blocks: [
        { p: "To the extent the law allows, VNX.SI is not liable for indirect or consequential loss, for loss of profit or data, or for anything that happens in an agreement between a client and a builder. Nothing in these terms limits liability that cannot be limited by law." },
      ],
    },
    {
      heading: "12. Changes",
      blocks: [
        { p: "We may update these terms. We will change the \"Last updated\" date and, for important changes, tell signed-in users before the changes apply. If you keep using the site after that, the new terms apply." },
      ],
    },
    {
      heading: "13. Governing law",
      blocks: [
        { p: "These terms are governed by the law of Vietnam. Disputes will be handled by the competent courts of Vietnam, unless the law where you live gives you the right to bring a claim there." },
      ],
    },
    {
      heading: "14. Language",
      blocks: [
        { p: "These terms are written in English. If a translation differs from the English version, the English version applies." },
      ],
    },
  ],
};

const termsVi: LegalDoc = {
  title: "Điều khoản sử dụng",
  sections: [
    {
      heading: "1. Về điều khoản này",
      blocks: [
        { p: "Điều khoản này áp dụng khi bạn dùng vnx.si (\"VNX.SI\", \"chúng tôi\"). Khi dùng trang, bạn đồng ý với các điều khoản này. Nếu không đồng ý, vui lòng không dùng trang. Câu hỏi: contact@vnx.si." },
      ],
    },
    {
      heading: "2. VNX.SI là gì",
      blocks: [
        { p: "VNX.SI là chợ nơi builder đăng sản phẩm được xây bằng AI, và người cần phần mềm tìm được sản phẩm đó cùng người đã xây nó. VNX.SI kết nối hai bên. Chúng tôi không phải một bên trong bất kỳ thỏa thuận nào giữa client và builder, và hiện chưa xử lý thanh toán." },
      ],
    },
    {
      heading: "3. Ai được dùng VNX.SI",
      blocks: [
        {
          ul: [
            "Bạn phải từ 16 tuổi trở lên để để lại email trong danh sách chờ.",
            "Bạn phải từ 18 tuổi trở lên để tạo hồ sơ builder, đăng sản phẩm, hoặc thỏa thuận mua bán hay dự án với người dùng khác.",
            "Bạn phải dùng email đúng và giữ quyền truy cập email đó, vì chúng tôi đăng nhập bằng link gửi qua email.",
          ],
        },
      ],
    },
    {
      heading: "4. Tài khoản của bạn",
      blocks: [
        { p: "Bạn đăng nhập bằng link dùng một lần gửi tới email. Sau khi đăng nhập bằng link qua email, bạn có thể liên kết tài khoản Google, GitHub hoặc LinkedIn và dùng nó để đăng nhập. Hãy giữ an toàn hộp thư và các tài khoản đã liên kết; ai dùng được chúng đều có thể đăng nhập như bạn. Chúng tôi gửi email cho bạn mỗi khi có tài khoản được liên kết hoặc hủy liên kết. Báo cho chúng tôi qua contact@vnx.si nếu bạn nghĩ có người khác đã dùng tài khoản của bạn." },
      ],
    },
    {
      heading: "5. Builder và listing",
      blocks: [
        { p: "Nếu bạn đăng sản phẩm hoặc tạo hồ sơ builder:" },
        {
          ul: [
            "Thông tin bạn công khai phải đúng sự thật và bạn phải có quyền công khai nó, kể cả hình ảnh, tên và đường link.",
            "Bạn vẫn sở hữu nội dung của mình. Bạn cho VNX.SI quyền không độc quyền, trên toàn thế giới, không thu phí, để lưu trữ, hiển thị, dịch phần giao diện xung quanh, và dẫn link tới nội dung đó trên vnx.si và khi chia sẻ trang vnx.si, trong thời gian nội dung được công khai và một khoảng thời gian hợp lý sau khi bạn gỡ.",
            "Chúng tôi duyệt hồ sơ và sản phẩm trước khi công khai, và có thể yêu cầu sửa, từ chối, ẩn hoặc gỡ.",
            "Huy hiệu chỉ có nghĩa đúng như nội dung của nó (ví dụ \"Demo verified\" nghĩa là chúng tôi đã mở demo và nó chạy vào thời điểm kiểm). Huy hiệu không phải bảo hành, không phải lời bảo chứng, và không bảo đảm chất lượng, bảo mật hay sự phù hợp cho một mục đích.",
          ],
        },
      ],
    },
    {
      heading: "6. Client",
      blocks: [
        { p: "Khi bạn liên hệ builder, mua, thuê hoặc thỏa thuận dự án với builder, thỏa thuận đó là giữa bạn và builder. Hãy tự kiểm sản phẩm, giá, giấy phép và điều khoản trước khi đồng ý." },
      ],
    },
    {
      heading: "7. Những điều bạn không được làm",
      blocks: [
        {
          ul: [
            "Đăng nội dung sai sự thật, gây hiểu lầm, trái pháp luật, hoặc xâm phạm quyền của người khác.",
            "Tải lên mã độc, hoặc dẫn link tới trang gây hại cho người xem.",
            "Gửi spam, thu thập dữ liệu trang ở quy mô lớn, hoặc tìm cách phá, làm quá tải hay vượt qua cơ chế bảo mật.",
            "Giả làm người khác, hoặc dùng tài khoản của người khác.",
            "Tìm cách thay đổi thứ hạng, huy hiệu hay số liệu bằng hoạt động giả.",
          ],
        },
      ],
    },
    {
      heading: "8. Thứ hạng và link partner",
      blocks: [
        { p: "Thứ hạng trên VNX.SI không bao giờ được bán. Một số link tới sản phẩm của công ty khác là link partner hoặc affiliate: nếu bạn đăng ký hoặc mua qua các link đó, VNX.SI có thể nhận hoa hồng. Trang có link như vậy sẽ ghi rõ. Hoa hồng không bao giờ thay đổi cách xếp hạng sản phẩm." },
      ],
    },
    {
      heading: "9. Tạm khóa và gỡ bỏ",
      blocks: [
        { p: "Chúng tôi có thể tạm khóa tài khoản, hoặc ẩn hay gỡ nội dung, nếu vi phạm điều khoản này, gây rủi ro cho người dùng khác, hoặc khi pháp luật yêu cầu. Khi hợp lý, chúng tôi sẽ cho bạn biết lý do." },
      ],
    },
    {
      heading: "10. Không bảo đảm",
      blocks: [
        { p: "VNX.SI được cung cấp \"nguyên trạng\". Chúng tôi cố gắng giữ trang hoạt động và chính xác, nhưng không hứa trang sẽ không gián đoạn, không lỗi, hay bất kỳ sản phẩm hoặc builder nào trên trang phù hợp với bạn." },
      ],
    },
    {
      heading: "11. Giới hạn trách nhiệm",
      blocks: [
        { p: "Trong phạm vi pháp luật cho phép, VNX.SI không chịu trách nhiệm về thiệt hại gián tiếp hoặc hệ quả, mất lợi nhuận hoặc dữ liệu, hoặc bất cứ điều gì xảy ra trong thỏa thuận giữa client và builder. Không điều nào ở đây giới hạn trách nhiệm mà pháp luật không cho phép giới hạn." },
      ],
    },
    {
      heading: "12. Thay đổi",
      blocks: [
        { p: "Chúng tôi có thể cập nhật điều khoản này. Chúng tôi sẽ đổi ngày \"Cập nhật lần cuối\" và, với thay đổi quan trọng, báo cho người dùng đã đăng nhập trước khi thay đổi có hiệu lực. Nếu bạn tiếp tục dùng trang sau đó, điều khoản mới được áp dụng." },
      ],
    },
    {
      heading: "13. Luật áp dụng",
      blocks: [
        { p: "Điều khoản này tuân theo pháp luật Việt Nam. Tranh chấp do tòa án có thẩm quyền tại Việt Nam giải quyết, trừ khi pháp luật nơi bạn sống cho bạn quyền khởi kiện ở đó." },
      ],
    },
    {
      heading: "14. Ngôn ngữ",
      blocks: [
        { p: "Điều khoản này được viết bằng tiếng Anh. Nếu bản dịch khác bản tiếng Anh, bản tiếng Anh được áp dụng." },
      ],
    },
  ],
};

const privacyEn: LegalDoc = {
  title: "Privacy Policy",
  sections: [
    {
      heading: "1. Who we are",
      blocks: [
        { p: "This policy explains how VNX.SI (\"we\") handles personal data on vnx.si. Contact for any privacy question or request: contact@vnx.si." },
      ],
    },
    {
      heading: "2. What we collect",
      blocks: [
        {
          ul: [
            "**Account:** your email address, the display name you choose, your language, whether you are an admin, and when you last signed in.",
            "**Sign-in:** one-time sign-in links (stored only as a hash, valid for 15 minutes) and session records (stored only as a hash), including whether you signed in by email link or with a linked account.",
            "**Linked accounts:** if you link a Google, GitHub or LinkedIn account to your VNX.SI account, we store which service it is, the ID that service gives your account, and a label so you can recognise it (the email address for Google and LinkedIn, the username for GitHub), plus when you linked it and when you last signed in with it. When you sign in with one of these services, it sends us your basic profile; we keep only what is listed here. We never receive or store the password of that account, and we do not keep the access keys the service gives us.",
            "**Builder profile and products:** what you enter in your profile and listings (name, headline, bio, country, skills, rates, links, product descriptions, prices, images). This content is **public** once approved.",
            "**Inquiries:** when you contact a builder, the name you type, your messages, the type of request, your budget range, an optional deadline, and the product or builder it is about. If you are not signed in, we also take your email address and create an account for it; nothing reaches the builder until you confirm that email.",
            "**Requests:** when you post a request, the name you type, the title, the description, the category, your budget range, an optional deadline and the languages you want to work in. If you are not signed in, we also take your email address and create an account for it; nothing is reviewed until you confirm that email.",
            "**Proposals:** if you are a builder and we invite you to a request, the approach, price, timeline and notes you send, or that you declined.",
            "**Waitlist:** your email, the time you agreed to be contacted, the language of the page, your country as detected by our hosting provider, the website you came from (domain only, not the full address), and campaign tags (`utm_*`) if the link you followed had them.",
            "**Outbound clicks:** when you follow a button or link that goes to another company's website through our `/go/` address, we record the time, which link it was, which kind of page it was on, the language of the page you were on, your country (detected by our hosting provider), the website you came from (domain only) and whether the visit looks like an automated bot. We record the click even when the link carries no tracking code. We do not store your IP address, your email address or your account with that record, and for now we do not link it to any visitor identifier.",
            "**Questions and feedback:** when you use our contact form, your email, the name you give (optional), whether you are a builder or a client, what your message is about, the message itself, the language of the page, and your account if you are signed in.",
            "**Security:** your IP address and a hash of your email in short-lived counters that limit how often a form can be used, and a record of actions taken by admins (for example approving a profile).",
            "**Bot check:** when you send an inquiry, a request or a contact message without signing in, Cloudflare Turnstile checks that you are a person. Cloudflare receives your IP address and information from your browser for this check.",
          ],
        },
        { p: "We do not collect payment details. We do not use third-party analytics, advertising or tracking cookies." },
      ],
    },
    {
      heading: "3. Why we use it",
      blocks: [
        {
          ul: [
            "To sign you in and keep you signed in.",
            "To let you sign in with an account you have linked and, if you are a builder and choose to, to show on your public profile that you own a GitHub or LinkedIn account.",
            "To show builder profiles and products publicly, and to review them before they go public.",
            "To email you about your account, your listings, or, if you joined the waitlist, when the marketplace opens.",
            "To pass inquiries and replies between clients and builders, and to email the other side when there is a new message (the email includes the message).",
            "To match requests with builders: our team reads each request and invites up to five builders, who see the request and send proposals; when you pick a proposal we start an inquiry between you and that builder with the request and the proposal as the first message.",
            "To count how often links to other companies are followed and, for partner links, to let the partner tell which of our links a visit came from (the link may carry a random click code; on VNX.SI it is not linked to your name, email address or account).",
            "To read and answer the questions and feedback you send us.",
            "To protect the site against spam and abuse.",
          ],
        },
        { p: "We rely on your consent (waitlist, contact form), on what is needed to provide the service you asked for (account, listings), and on our legitimate interest in keeping the site secure." },
      ],
    },
    {
      heading: "4. Who can see it",
      blocks: [
        {
          ul: [
            "Builder profiles and approved products are public.",
            "Your linked accounts are shown only to you. A builder can choose to show their GitHub username, or the fact that their LinkedIn account is verified, on their public profile. Google accounts are never shown, and builders never see a client's linked accounts.",
            "When you sign in with Google, GitHub or LinkedIn, that service knows you signed in to VNX.SI and handles that under its own privacy policy.",
            "Builders do not see clients' email addresses. A builder sees the name you typed, your messages, your budget range and deadline; a builder invited to your request also sees the request.",
            "When you follow a link to a partner you leave VNX.SI. The partner can see that you came from VNX.SI, and the click code if the link carries one. It handles your data under its own privacy policy, and it may set its own cookies or tracking when you arrive on its site.",
            "Messages sent through the contact form are read only by the VNX.SI team; a copy is delivered to our mailbox through Resend.",
            "Service providers process data for us: **Cloudflare** (hosting, database, file storage, security, including the Turnstile bot check) and **Resend** (sending email). They may process data outside your country.",
            "We do not sell personal data. We share it with authorities only when the law requires it.",
          ],
        },
      ],
    },
    {
      heading: "5. Cookies",
      blocks: [
        { p: "We use only cookies that the site needs to work:" },
        {
          ul: [
            "`__Host-vnx_session`: keeps you signed in, for up to 30 days.",
            "`__Host-vnx_invite`: remembers a builder invite link for 1 hour.",
            "`__Host-vnx_oauth`: keeps a sign-in with Google, GitHub or LinkedIn secure while you go to that service and back, for up to 10 minutes.",
          ],
        },
      ],
    },
    {
      heading: "6. How long we keep it",
      blocks: [
        {
          ul: [
            "Sign-in links: 15 minutes. Sessions: up to 30 days, or until you sign out.",
            "Linked accounts: until you unlink them or your account is deleted.",
            "Rate-limit counters (including IP addresses): deleted regularly once they expire.",
            "Outbound click records: deleted after 13 months.",
            "Inquiries and their messages: while your account exists, under the same rule as your account below. Inquiries you never confirmed, and accounts created for them that were never confirmed: deleted after 48 hours.",
            "Requests and proposals: while your account exists, under the same rule as your account below. Requests you never confirmed: deleted after 48 hours.",
            "Questions and feedback: until we have answered and dealt with them, plus 12 months, or until you ask us to delete them.",
            "Account, profile and listings: while your account exists. When you ask us to delete it, we delete or anonymise it, except records we must keep by law or to protect the site.",
            "Waitlist: until the marketplace opens to clients plus 12 months, or until you ask us to remove you.",
          ],
        },
      ],
    },
    {
      heading: "7. Your rights",
      blocks: [
        { p: "You can ask to see, correct, export or delete your personal data, to withdraw your consent, or to object to how we use it. Email contact@vnx.si from the address you used with us. We reply within 30 days. You can also complain to the data protection authority where you live." },
      ],
    },
    {
      heading: "8. Security",
      blocks: [
        { p: "Sessions and sign-in links are stored only as hashes, the site is served over HTTPS only, and admin actions are logged. We email you whenever an account is linked to or unlinked from yours. No system is perfectly secure; tell us at contact@vnx.si if you find a problem." },
      ],
    },
    {
      heading: "9. Children",
      blocks: [
        { p: "VNX.SI is not for children. You must be at least 16 to join the waitlist and 18 to be a builder." },
      ],
    },
    {
      heading: "10. Changes",
      blocks: [
        { p: "When we change this policy we update the date above. For important changes we will tell signed-in users before they apply." },
      ],
    },
    {
      heading: "11. Language",
      blocks: [
        { p: "If a translation differs from the English version, the English version applies." },
      ],
    },
  ],
};

const privacyEnM7: LegalDoc = {
  title: "Privacy Policy",
  sections: [
    {
      heading: "1. Who we are",
      blocks: [
        { p: "This policy explains how VNX.SI (\"we\") handles personal data on vnx.si. Contact for any privacy question or request: contact@vnx.si." },
      ],
    },
    {
      heading: "2. What we collect",
      blocks: [
        {
          ul: [
            "**Account:** your email address, the display name you choose, your language, whether you are an admin, and when you last signed in.",
            "**Sign-in:** one-time sign-in links (stored only as a hash, valid for 15 minutes) and session records (stored only as a hash), including whether you signed in by email link or with a linked account.",
            "**Linked accounts:** if you link a Google, GitHub or LinkedIn account to your VNX.SI account, we store which service it is, the ID that service gives your account, and a label so you can recognise it (the email address for Google and LinkedIn, the username for GitHub), plus when you linked it and when you last signed in with it. When you sign in with one of these services, it sends us your basic profile; we keep only what is listed here. We never receive or store the password of that account, and we do not keep the access keys the service gives us.",
            "**Builder profile and products:** what you enter in your profile and listings (name, headline, bio, country, skills, rates, links, product descriptions, prices, images). This content is **public** once approved.",
            "**Inquiries:** when you contact a builder, the name you type, your messages, the type of request, your budget range, an optional deadline, and the product or builder it is about. If you are not signed in, we also take your email address and create an account for it; nothing reaches the builder until you confirm that email.",
            "**Requests:** when you post a request, the name you type, the title, the description, the category, your budget range, an optional deadline and the languages you want to work in. If you are not signed in, we also take your email address and create an account for it; nothing is reviewed until you confirm that email.",
            "**Proposals:** if you are a builder and we invite you to a request, the approach, price, timeline and notes you send, or that you declined.",
            "**Waitlist:** your email, the time you agreed to be contacted, the language of the page, your country as detected by our hosting provider, the website you came from (domain only, not the full address), and campaign tags (`utm_*`) if the link you followed had them.",
            "**Outbound clicks:** when you follow a button or link that goes to another company's website through our `/go/` address, we record the time, which link it was, which kind of page it was on, the language of the page you were on, your country (detected by our hosting provider), the website you came from (domain only) and whether the visit looks like an automated bot. We record the click even when the link carries no tracking code. We do not store your IP address, your email address or your account with that record. The record may hold the day-specific code described under \"Visit counting\", which cannot be matched across days.",
            "**Visit counting:** when you open a product page, we store the random code described in section 5 (Cookies) in a cookie. We combine it with a secret that changes every day, so each product page, and each of its demo or website links, is counted at most once per visitor per day, and the result cannot be matched from one day to the next. We do not count visits that look like automated bots, visits by the product's own builder, or visits by our team. If your browser blocks the cookie, the page works the same, but each visit may be counted.",
            "**Questions and feedback:** when you use our contact form, your email, the name you give (optional), whether you are a builder or a client, what your message is about, the message itself, the language of the page, and your account if you are signed in.",
            "**Security:** your IP address and a hash of your email in short-lived counters that limit how often a form can be used, and a record of actions taken by admins (for example approving a profile).",
            "**Bot check:** when you send an inquiry, a request or a contact message without signing in, Cloudflare Turnstile checks that you are a person. Cloudflare receives your IP address and information from your browser for this check.",
          ],
        },
        { p: "We do not collect payment details. We do not use third-party analytics, advertising or tracking cookies." },
      ],
    },
    {
      heading: "3. Why we use it",
      blocks: [
        {
          ul: [
            "To sign you in and keep you signed in.",
            "To let you sign in with an account you have linked and, if you are a builder and choose to, to show on your public profile that you own a GitHub or LinkedIn account.",
            "To show builder profiles and products publicly, and to review them before they go public.",
            "To email you about your account, your listings, or, if you joined the waitlist, when the marketplace opens.",
            "To pass inquiries and replies between clients and builders, and to email the other side when there is a new message (the email includes the message).",
            "To match requests with builders: our team reads each request and invites up to five builders, who see the request and send proposals; when you pick a proposal we start an inquiry between you and that builder with the request and the proposal as the first message.",
            "To count how often links to other companies are followed and, for partner links, to let the partner tell which of our links a visit came from (the link may carry a random click code; on VNX.SI it is not linked to your name, email address or account).",
            "To count visits to product pages and clicks on a product's demo and website links, so that we can show public statistics (for example which products are trending).",
            "To read and answer the questions and feedback you send us.",
            "To protect the site against spam and abuse.",
          ],
        },
        { p: "We rely on your consent (waitlist, contact form), on what is needed to provide the service you asked for (account, listings), and on our legitimate interest in keeping the site secure. For counting visits we rely on our legitimate interest in measuring how the site is used. You can object at any time by turning on the Global Privacy Control signal in your browser: we then set no cookie and count nothing." },
      ],
    },
    {
      heading: "4. Who can see it",
      blocks: [
        {
          ul: [
            "Builder profiles and approved products are public.",
            "Your linked accounts are shown only to you. A builder can choose to show their GitHub username, or the fact that their LinkedIn account is verified, on their public profile. Google accounts are never shown, and builders never see a client's linked accounts.",
            "When you sign in with Google, GitHub or LinkedIn, that service knows you signed in to VNX.SI and handles that under its own privacy policy.",
            "Builders do not see clients' email addresses. A builder sees the name you typed, your messages, your budget range and deadline; a builder invited to your request also sees the request.",
            "When you follow a link to a partner you leave VNX.SI. The partner can see that you came from VNX.SI, and the click code if the link carries one. It handles your data under its own privacy policy, and it may set its own cookies or tracking when you arrive on its site.",
            "Messages sent through the contact form are read only by the VNX.SI team; a copy is delivered to our mailbox through Resend.",
            "Service providers process data for us: **Cloudflare** (hosting, database, file storage, security, including the Turnstile bot check) and **Resend** (sending email). They may process data outside your country.",
            "We do not sell personal data. We share it with authorities only when the law requires it.",
          ],
        },
      ],
    },
    {
      heading: "5. Cookies",
      blocks: [
        { p: "We use only cookies that the site needs to work, and one cookie to count visits." },
        {
          ul: [
            "`__Host-vnx_session`: keeps you signed in, for up to 30 days.",
            "`__Host-vnx_invite`: remembers a builder invite link for 1 hour.",
            "`__Host-vnx_oauth`: keeps a sign-in with Google, GitHub or LinkedIn secure while you go to that service and back, for up to 10 minutes.",
            "`__Host-vnx_vid`: a random code, not linked to your name, e-mail address or account, used only to count visits to product pages. It expires at the end of the current day (UTC). We do not set it if your browser sends the Global Privacy Control signal (`Sec-GPC: 1`).",
          ],
        },
      ],
    },
    {
      heading: "6. How long we keep it",
      blocks: [
        {
          ul: [
            "Sign-in links: 15 minutes. Sessions: up to 30 days, or until you sign out.",
            "Linked accounts: until you unlink them or your account is deleted.",
            "Rate-limit counters (including IP addresses): deleted regularly once they expire.",
            "Outbound click records: deleted after 13 months.",
            "Daily de-duplication records: deleted after 2 days.",
            "Inquiries and their messages: while your account exists, under the same rule as your account below. Inquiries you never confirmed, and accounts created for them that were never confirmed: deleted after 48 hours.",
            "Requests and proposals: while your account exists, under the same rule as your account below. Requests you never confirmed: deleted after 48 hours.",
            "Questions and feedback: until we have answered and dealt with them, plus 12 months, or until you ask us to delete them.",
            "Account, profile and listings: while your account exists. When you ask us to delete it, we delete or anonymise it, except records we must keep by law or to protect the site.",
            "Waitlist: until the marketplace opens to clients plus 12 months, or until you ask us to remove you.",
          ],
        },
      ],
    },
    {
      heading: "7. Your rights",
      blocks: [
        { p: "You can ask to see, correct, export or delete your personal data, to withdraw your consent, or to object to how we use it. Email contact@vnx.si from the address you used with us. We reply within 30 days. You can also complain to the data protection authority where you live." },
      ],
    },
    {
      heading: "8. Security",
      blocks: [
        { p: "Sessions and sign-in links are stored only as hashes, the site is served over HTTPS only, and admin actions are logged. We email you whenever an account is linked to or unlinked from yours. No system is perfectly secure; tell us at contact@vnx.si if you find a problem." },
      ],
    },
    {
      heading: "9. Children",
      blocks: [
        { p: "VNX.SI is not for children. You must be at least 16 to join the waitlist and 18 to be a builder." },
      ],
    },
    {
      heading: "10. Changes",
      blocks: [
        { p: "When we change this policy we update the date above. For important changes we will tell signed-in users before they apply." },
      ],
    },
    {
      heading: "11. Language",
      blocks: [
        { p: "If a translation differs from the English version, the English version applies." },
      ],
    },
  ],
};

const privacyVi: LegalDoc = {
  title: "Chính sách quyền riêng tư",
  sections: [
    {
      heading: "1. Chúng tôi là ai",
      blocks: [
        { p: "Chính sách này giải thích cách VNX.SI (\"chúng tôi\") xử lý dữ liệu cá nhân trên vnx.si. Liên hệ cho mọi câu hỏi hoặc yêu cầu về quyền riêng tư: contact@vnx.si." },
      ],
    },
    {
      heading: "2. Chúng tôi thu thập gì",
      blocks: [
        {
          ul: [
            "**Tài khoản:** email, tên hiển thị bạn chọn, ngôn ngữ, bạn có phải admin không, và lần đăng nhập gần nhất.",
            "**Đăng nhập:** link đăng nhập dùng một lần (chỉ lưu dạng hash, hiệu lực 15 phút) và bản ghi phiên đăng nhập (chỉ lưu dạng hash), gồm cả việc bạn đăng nhập bằng link qua email hay bằng tài khoản liên kết.",
            "**Tài khoản liên kết:** nếu bạn liên kết tài khoản Google, GitHub hoặc LinkedIn với tài khoản VNX.SI, chúng tôi lưu đó là dịch vụ nào, mã định danh dịch vụ đó cấp cho tài khoản của bạn, và một nhãn để bạn nhận ra (email với Google và LinkedIn, tên người dùng với GitHub), cùng thời điểm liên kết và lần gần nhất bạn đăng nhập bằng nó. Khi bạn đăng nhập bằng một trong các dịch vụ này, dịch vụ gửi cho chúng tôi thông tin hồ sơ cơ bản; chúng tôi chỉ giữ những gì ghi ở đây. Chúng tôi không bao giờ nhận hay lưu mật khẩu của tài khoản đó, và không giữ khóa truy cập mà dịch vụ cấp cho chúng tôi.",
            "**Hồ sơ builder và sản phẩm:** những gì bạn nhập vào hồ sơ và listing (tên, tiêu đề, giới thiệu, quốc gia, kỹ năng, mức giá, link, mô tả sản phẩm, giá, hình ảnh). Nội dung này **công khai** sau khi được duyệt.",
            "**Yêu cầu (Inquiry):** khi bạn liên hệ một builder, tên bạn gõ, các tin nhắn, loại yêu cầu, khoảng ngân sách, hạn chót (nếu có), và sản phẩm hoặc builder được hỏi. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; builder chưa nhận được gì cho tới khi bạn xác nhận email.",
            "**Nhu cầu (request):** khi bạn đăng nhu cầu, tên bạn gõ, tiêu đề, mô tả, danh mục, khoảng ngân sách, hạn chót (nếu có) và các ngôn ngữ bạn muốn làm việc. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; nhu cầu chưa được xem xét cho tới khi bạn xác nhận email.",
            "**Đề xuất:** nếu bạn là builder và được mời vào một nhu cầu, cách làm, giá, thời gian và ghi chú bạn gửi, hoặc việc bạn từ chối.",
            "**Danh sách chờ:** email, thời điểm bạn đồng ý nhận liên hệ, ngôn ngữ của trang, quốc gia do nhà cung cấp hosting nhận diện, trang web bạn đến từ đó (chỉ tên miền, không phải địa chỉ đầy đủ), và thẻ chiến dịch (`utm_*`) nếu link bạn bấm có.",
            "**Lượt bấm link ra ngoài:** khi bạn bấm một nút hoặc link dẫn tới website của công ty khác qua địa chỉ `/go/` của chúng tôi, chúng tôi ghi lại thời điểm, đó là link nào, nằm trên loại trang nào, ngôn ngữ của trang bạn đang xem, quốc gia của bạn (do nhà cung cấp hosting nhận diện), trang web bạn đến từ đó (chỉ tên miền) và việc lượt truy cập có giống bot tự động không. Chúng tôi ghi lượt bấm cả khi link không mang mã theo dõi nào. Chúng tôi không lưu địa chỉ IP, email hay tài khoản của bạn cùng bản ghi đó, và hiện chưa gắn nó với bất kỳ mã nhận diện người xem nào.",
            "**Câu hỏi và góp ý:** khi bạn dùng form liên hệ, email của bạn, tên bạn cung cấp (không bắt buộc), bạn là builder hay client, tin nhắn nói về điều gì, nội dung tin nhắn, ngôn ngữ của trang, và tài khoản của bạn nếu đã đăng nhập.",
            "**Bảo mật:** địa chỉ IP và hash email của bạn trong các bộ đếm ngắn hạn để giới hạn số lần dùng form, và bản ghi thao tác của admin (ví dụ duyệt hồ sơ).",
            "**Kiểm tra chống bot:** khi bạn gửi yêu cầu, nhu cầu hoặc tin nhắn liên hệ mà chưa đăng nhập, Cloudflare Turnstile kiểm tra bạn là người thật. Cloudflare nhận địa chỉ IP và thông tin từ trình duyệt của bạn để kiểm tra.",
          ],
        },
        { p: "Chúng tôi không thu thông tin thanh toán. Chúng tôi không dùng analytics, quảng cáo hay cookie theo dõi của bên thứ ba." },
      ],
    },
    {
      heading: "3. Chúng tôi dùng để làm gì",
      blocks: [
        {
          ul: [
            "Đăng nhập và giữ bạn đăng nhập.",
            "Cho bạn đăng nhập bằng tài khoản đã liên kết và, nếu bạn là builder và tự chọn, hiện trên hồ sơ công khai rằng bạn sở hữu tài khoản GitHub hoặc LinkedIn.",
            "Hiển thị công khai hồ sơ builder và sản phẩm, và duyệt chúng trước khi công khai.",
            "Gửi email về tài khoản, listing của bạn, hoặc, nếu bạn vào danh sách chờ, báo khi chợ mở.",
            "Chuyển yêu cầu và trả lời giữa client và builder, và gửi email báo bên kia khi có tin nhắn mới (email có kèm nội dung tin nhắn).",
            "Ghép nhu cầu với builder: đội ngũ của chúng tôi đọc từng nhu cầu và mời tối đa năm builder; các builder đó xem nhu cầu và gửi đề xuất; khi bạn chọn một đề xuất, chúng tôi mở một yêu cầu giữa bạn và builder đó với nội dung nhu cầu và đề xuất làm tin nhắn đầu tiên.",
            "Đếm số lần các link tới công ty khác được bấm và, với link partner, để partner biết một lượt truy cập đến từ link nào của chúng tôi (link có thể mang một mã bấm ngẫu nhiên; trên VNX.SI mã đó không gắn với tên, email hay tài khoản của bạn).",
            "Đọc và trả lời các câu hỏi, góp ý bạn gửi cho chúng tôi.",
            "Bảo vệ trang khỏi spam và lạm dụng.",
          ],
        },
        { p: "Căn cứ của chúng tôi là sự đồng ý của bạn (danh sách chờ, form liên hệ), nhu cầu để cung cấp dịch vụ bạn yêu cầu (tài khoản, listing), và lợi ích chính đáng trong việc giữ an toàn cho trang." },
      ],
    },
    {
      heading: "4. Ai thấy được dữ liệu",
      blocks: [
        {
          ul: [
            "Hồ sơ builder và sản phẩm đã duyệt là công khai.",
            "Tài khoản liên kết của bạn chỉ hiện cho chính bạn. Builder có thể chọn hiện tên người dùng GitHub, hoặc việc tài khoản LinkedIn đã được xác minh, trên hồ sơ công khai. Tài khoản Google không bao giờ được hiện, và builder không bao giờ thấy tài khoản liên kết của client.",
            "Khi bạn đăng nhập bằng Google, GitHub hoặc LinkedIn, dịch vụ đó biết bạn đã đăng nhập vào VNX.SI và xử lý việc này theo chính sách quyền riêng tư của họ.",
            "Builder không thấy email của client. Builder thấy tên bạn gõ, các tin nhắn, khoảng ngân sách và hạn chót; builder được mời vào nhu cầu của bạn thấy thêm nhu cầu đó.",
            "Khi bạn bấm link tới một partner, bạn rời VNX.SI. Partner thấy được bạn đến từ VNX.SI, và mã bấm nếu link có mang. Họ xử lý dữ liệu của bạn theo chính sách quyền riêng tư của họ, và có thể đặt cookie hoặc theo dõi riêng khi bạn vào trang của họ.",
            "Tin nhắn gửi qua form liên hệ chỉ đội ngũ VNX.SI đọc; một bản được chuyển tới hộp thư của chúng tôi qua Resend.",
            "Các nhà cung cấp dịch vụ xử lý dữ liệu thay chúng tôi: **Cloudflare** (hosting, cơ sở dữ liệu, lưu trữ file, bảo mật, gồm cả kiểm tra chống bot Turnstile) và **Resend** (gửi email). Họ có thể xử lý dữ liệu ngoài quốc gia của bạn.",
            "Chúng tôi không bán dữ liệu cá nhân. Chúng tôi chỉ cung cấp cho cơ quan chức năng khi pháp luật yêu cầu.",
          ],
        },
      ],
    },
    {
      heading: "5. Cookie",
      blocks: [
        { p: "Chúng tôi chỉ dùng cookie cần thiết để trang hoạt động:" },
        {
          ul: [
            "`__Host-vnx_session`: giữ bạn đăng nhập, tối đa 30 ngày.",
            "`__Host-vnx_invite`: ghi nhớ link mời builder trong 1 giờ.",
            "`__Host-vnx_oauth`: giữ an toàn cho lượt đăng nhập bằng Google, GitHub hoặc LinkedIn trong lúc bạn sang dịch vụ đó và quay lại, tối đa 10 phút.",
          ],
        },
      ],
    },
    {
      heading: "6. Chúng tôi giữ bao lâu",
      blocks: [
        {
          ul: [
            "Link đăng nhập: 15 phút. Phiên đăng nhập: tối đa 30 ngày, hoặc tới khi bạn đăng xuất.",
            "Tài khoản liên kết: tới khi bạn hủy liên kết hoặc tài khoản của bạn bị xóa.",
            "Bộ đếm giới hạn (gồm địa chỉ IP): được xóa định kỳ khi hết hạn.",
            "Bản ghi lượt bấm link ra ngoài: xóa sau 13 tháng.",
            "Yêu cầu và tin nhắn: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Yêu cầu bạn chưa xác nhận, và tài khoản tạo cho chúng mà chưa từng xác nhận: xóa sau 48 giờ.",
            "Nhu cầu và đề xuất: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Nhu cầu bạn chưa xác nhận: xóa sau 48 giờ.",
            "Câu hỏi và góp ý: tới khi chúng tôi đã trả lời và xử lý xong, cộng 12 tháng, hoặc tới khi bạn yêu cầu xóa.",
            "Tài khoản, hồ sơ và listing: trong thời gian tài khoản tồn tại. Khi bạn yêu cầu xóa, chúng tôi xóa hoặc ẩn danh, trừ các bản ghi phải giữ theo luật hoặc để bảo vệ trang.",
            "Danh sách chờ: tới khi chợ mở cho client cộng 12 tháng, hoặc tới khi bạn yêu cầu gỡ.",
          ],
        },
      ],
    },
    {
      heading: "7. Quyền của bạn",
      blocks: [
        { p: "Bạn có thể yêu cầu xem, sửa, xuất hoặc xóa dữ liệu cá nhân, rút lại sự đồng ý, hoặc phản đối cách chúng tôi dùng dữ liệu. Gửi email tới contact@vnx.si từ địa chỉ bạn đã dùng với chúng tôi. Chúng tôi trả lời trong 30 ngày. Bạn cũng có thể khiếu nại với cơ quan bảo vệ dữ liệu nơi bạn sống." },
      ],
    },
    {
      heading: "8. Bảo mật",
      blocks: [
        { p: "Phiên và link đăng nhập chỉ được lưu dạng hash, trang chỉ phục vụ qua HTTPS, và thao tác của admin được ghi lại. Chúng tôi gửi email cho bạn mỗi khi có tài khoản được liên kết hoặc hủy liên kết với tài khoản của bạn. Không hệ thống nào an toàn tuyệt đối; hãy báo cho chúng tôi qua contact@vnx.si nếu bạn phát hiện vấn đề." },
      ],
    },
    {
      heading: "9. Trẻ em",
      blocks: [
        { p: "VNX.SI không dành cho trẻ em. Bạn phải từ 16 tuổi để vào danh sách chờ và từ 18 tuổi để làm builder." },
      ],
    },
    {
      heading: "10. Thay đổi",
      blocks: [
        { p: "Khi thay đổi chính sách này, chúng tôi cập nhật ngày ở trên. Với thay đổi quan trọng, chúng tôi báo cho người dùng đã đăng nhập trước khi có hiệu lực." },
      ],
    },
    {
      heading: "11. Ngôn ngữ",
      blocks: [
        { p: "Nếu bản dịch khác bản tiếng Anh, bản tiếng Anh được áp dụng." },
      ],
    },
  ],
};

const privacyViM7: LegalDoc = {
  title: "Chính sách quyền riêng tư",
  sections: [
    {
      heading: "1. Chúng tôi là ai",
      blocks: [
        { p: "Chính sách này giải thích cách VNX.SI (\"chúng tôi\") xử lý dữ liệu cá nhân trên vnx.si. Liên hệ cho mọi câu hỏi hoặc yêu cầu về quyền riêng tư: contact@vnx.si." },
      ],
    },
    {
      heading: "2. Chúng tôi thu thập gì",
      blocks: [
        {
          ul: [
            "**Tài khoản:** email, tên hiển thị bạn chọn, ngôn ngữ, bạn có phải admin không, và lần đăng nhập gần nhất.",
            "**Đăng nhập:** link đăng nhập dùng một lần (chỉ lưu dạng hash, hiệu lực 15 phút) và bản ghi phiên đăng nhập (chỉ lưu dạng hash), gồm cả việc bạn đăng nhập bằng link qua email hay bằng tài khoản liên kết.",
            "**Tài khoản liên kết:** nếu bạn liên kết tài khoản Google, GitHub hoặc LinkedIn với tài khoản VNX.SI, chúng tôi lưu đó là dịch vụ nào, mã định danh dịch vụ đó cấp cho tài khoản của bạn, và một nhãn để bạn nhận ra (email với Google và LinkedIn, tên người dùng với GitHub), cùng thời điểm liên kết và lần gần nhất bạn đăng nhập bằng nó. Khi bạn đăng nhập bằng một trong các dịch vụ này, dịch vụ gửi cho chúng tôi thông tin hồ sơ cơ bản; chúng tôi chỉ giữ những gì ghi ở đây. Chúng tôi không bao giờ nhận hay lưu mật khẩu của tài khoản đó, và không giữ khóa truy cập mà dịch vụ cấp cho chúng tôi.",
            "**Hồ sơ builder và sản phẩm:** những gì bạn nhập vào hồ sơ và listing (tên, tiêu đề, giới thiệu, quốc gia, kỹ năng, mức giá, link, mô tả sản phẩm, giá, hình ảnh). Nội dung này **công khai** sau khi được duyệt.",
            "**Yêu cầu (Inquiry):** khi bạn liên hệ một builder, tên bạn gõ, các tin nhắn, loại yêu cầu, khoảng ngân sách, hạn chót (nếu có), và sản phẩm hoặc builder được hỏi. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; builder chưa nhận được gì cho tới khi bạn xác nhận email.",
            "**Nhu cầu (request):** khi bạn đăng nhu cầu, tên bạn gõ, tiêu đề, mô tả, danh mục, khoảng ngân sách, hạn chót (nếu có) và các ngôn ngữ bạn muốn làm việc. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; nhu cầu chưa được xem xét cho tới khi bạn xác nhận email.",
            "**Đề xuất:** nếu bạn là builder và được mời vào một nhu cầu, cách làm, giá, thời gian và ghi chú bạn gửi, hoặc việc bạn từ chối.",
            "**Danh sách chờ:** email, thời điểm bạn đồng ý nhận liên hệ, ngôn ngữ của trang, quốc gia do nhà cung cấp hosting nhận diện, trang web bạn đến từ đó (chỉ tên miền, không phải địa chỉ đầy đủ), và thẻ chiến dịch (`utm_*`) nếu link bạn bấm có.",
            "**Lượt bấm link ra ngoài:** khi bạn bấm một nút hoặc link dẫn tới website của công ty khác qua địa chỉ `/go/` của chúng tôi, chúng tôi ghi lại thời điểm, đó là link nào, nằm trên loại trang nào, ngôn ngữ của trang bạn đang xem, quốc gia của bạn (do nhà cung cấp hosting nhận diện), trang web bạn đến từ đó (chỉ tên miền) và việc lượt truy cập có giống bot tự động không. Chúng tôi ghi lượt bấm cả khi link không mang mã theo dõi nào. Chúng tôi không lưu địa chỉ IP, email hay tài khoản của bạn cùng bản ghi đó. Bản ghi có thể chứa mã theo ngày nêu ở \"Đếm lượt truy cập\", mã này không thể đối chiếu giữa các ngày.",
            "**Đếm lượt truy cập:** khi bạn mở trang một product, chúng tôi lưu mã ngẫu nhiên nêu ở mục 5 (Cookie) trong cookie. Chúng tôi kết hợp mã đó với một khóa bí mật đổi mỗi ngày, nên mỗi trang product, và mỗi link demo hay website của nó, được đếm tối đa một lần cho mỗi người mỗi ngày, và kết quả không thể đối chiếu từ ngày này sang ngày khác. Chúng tôi không đếm lượt truy cập giống bot tự động, lượt của chính builder của product, hay của đội ngũ chúng tôi. Nếu trình duyệt chặn cookie, trang vẫn hoạt động như cũ, nhưng mỗi lượt truy cập có thể bị đếm.",
            "**Câu hỏi và góp ý:** khi bạn dùng form liên hệ, email của bạn, tên bạn cung cấp (không bắt buộc), bạn là builder hay client, tin nhắn nói về điều gì, nội dung tin nhắn, ngôn ngữ của trang, và tài khoản của bạn nếu đã đăng nhập.",
            "**Bảo mật:** địa chỉ IP và hash email của bạn trong các bộ đếm ngắn hạn để giới hạn số lần dùng form, và bản ghi thao tác của admin (ví dụ duyệt hồ sơ).",
            "**Kiểm tra chống bot:** khi bạn gửi yêu cầu, nhu cầu hoặc tin nhắn liên hệ mà chưa đăng nhập, Cloudflare Turnstile kiểm tra bạn là người thật. Cloudflare nhận địa chỉ IP và thông tin từ trình duyệt của bạn để kiểm tra.",
          ],
        },
        { p: "Chúng tôi không thu thông tin thanh toán. Chúng tôi không dùng analytics, quảng cáo hay cookie theo dõi của bên thứ ba." },
      ],
    },
    {
      heading: "3. Chúng tôi dùng để làm gì",
      blocks: [
        {
          ul: [
            "Đăng nhập và giữ bạn đăng nhập.",
            "Cho bạn đăng nhập bằng tài khoản đã liên kết và, nếu bạn là builder và tự chọn, hiện trên hồ sơ công khai rằng bạn sở hữu tài khoản GitHub hoặc LinkedIn.",
            "Hiển thị công khai hồ sơ builder và sản phẩm, và duyệt chúng trước khi công khai.",
            "Gửi email về tài khoản, listing của bạn, hoặc, nếu bạn vào danh sách chờ, báo khi chợ mở.",
            "Chuyển yêu cầu và trả lời giữa client và builder, và gửi email báo bên kia khi có tin nhắn mới (email có kèm nội dung tin nhắn).",
            "Ghép nhu cầu với builder: đội ngũ của chúng tôi đọc từng nhu cầu và mời tối đa năm builder; các builder đó xem nhu cầu và gửi đề xuất; khi bạn chọn một đề xuất, chúng tôi mở một yêu cầu giữa bạn và builder đó với nội dung nhu cầu và đề xuất làm tin nhắn đầu tiên.",
            "Đếm số lần các link tới công ty khác được bấm và, với link partner, để partner biết một lượt truy cập đến từ link nào của chúng tôi (link có thể mang một mã bấm ngẫu nhiên; trên VNX.SI mã đó không gắn với tên, email hay tài khoản của bạn).",
            "Đếm lượt truy cập trang product và lượt bấm link demo, website của product, để hiện thống kê công khai (ví dụ product nào đang trending).",
            "Đọc và trả lời các câu hỏi, góp ý bạn gửi cho chúng tôi.",
            "Bảo vệ trang khỏi spam và lạm dụng.",
          ],
        },
        { p: "Căn cứ của chúng tôi là sự đồng ý của bạn (danh sách chờ, form liên hệ), nhu cầu để cung cấp dịch vụ bạn yêu cầu (tài khoản, listing), và lợi ích chính đáng trong việc giữ an toàn cho trang. Với việc đếm lượt truy cập, chúng tôi dựa trên lợi ích chính đáng trong việc đo lường cách trang được sử dụng. Bạn có thể phản đối bất cứ lúc nào bằng cách bật tín hiệu Global Privacy Control trong trình duyệt: khi đó chúng tôi không đặt cookie và không đếm gì." },
      ],
    },
    {
      heading: "4. Ai thấy được dữ liệu",
      blocks: [
        {
          ul: [
            "Hồ sơ builder và sản phẩm đã duyệt là công khai.",
            "Tài khoản liên kết của bạn chỉ hiện cho chính bạn. Builder có thể chọn hiện tên người dùng GitHub, hoặc việc tài khoản LinkedIn đã được xác minh, trên hồ sơ công khai. Tài khoản Google không bao giờ được hiện, và builder không bao giờ thấy tài khoản liên kết của client.",
            "Khi bạn đăng nhập bằng Google, GitHub hoặc LinkedIn, dịch vụ đó biết bạn đã đăng nhập vào VNX.SI và xử lý việc này theo chính sách quyền riêng tư của họ.",
            "Builder không thấy email của client. Builder thấy tên bạn gõ, các tin nhắn, khoảng ngân sách và hạn chót; builder được mời vào nhu cầu của bạn thấy thêm nhu cầu đó.",
            "Khi bạn bấm link tới một partner, bạn rời VNX.SI. Partner thấy được bạn đến từ VNX.SI, và mã bấm nếu link có mang. Họ xử lý dữ liệu của bạn theo chính sách quyền riêng tư của họ, và có thể đặt cookie hoặc theo dõi riêng khi bạn vào trang của họ.",
            "Tin nhắn gửi qua form liên hệ chỉ đội ngũ VNX.SI đọc; một bản được chuyển tới hộp thư của chúng tôi qua Resend.",
            "Các nhà cung cấp dịch vụ xử lý dữ liệu thay chúng tôi: **Cloudflare** (hosting, cơ sở dữ liệu, lưu trữ file, bảo mật, gồm cả kiểm tra chống bot Turnstile) và **Resend** (gửi email). Họ có thể xử lý dữ liệu ngoài quốc gia của bạn.",
            "Chúng tôi không bán dữ liệu cá nhân. Chúng tôi chỉ cung cấp cho cơ quan chức năng khi pháp luật yêu cầu.",
          ],
        },
      ],
    },
    {
      heading: "5. Cookie",
      blocks: [
        { p: "Chúng tôi chỉ dùng cookie cần thiết để trang hoạt động, và một cookie để đếm lượt truy cập." },
        {
          ul: [
            "`__Host-vnx_session`: giữ bạn đăng nhập, tối đa 30 ngày.",
            "`__Host-vnx_invite`: ghi nhớ link mời builder trong 1 giờ.",
            "`__Host-vnx_oauth`: giữ an toàn cho lượt đăng nhập bằng Google, GitHub hoặc LinkedIn trong lúc bạn sang dịch vụ đó và quay lại, tối đa 10 phút.",
            "`__Host-vnx_vid`: một mã ngẫu nhiên, không gắn với tên, email hay tài khoản của bạn, chỉ dùng để đếm lượt truy cập trang product. Cookie hết hạn vào cuối ngày hiện tại (UTC). Chúng tôi không đặt cookie này nếu trình duyệt của bạn gửi tín hiệu Global Privacy Control (`Sec-GPC: 1`).",
          ],
        },
      ],
    },
    {
      heading: "6. Chúng tôi giữ bao lâu",
      blocks: [
        {
          ul: [
            "Link đăng nhập: 15 phút. Phiên đăng nhập: tối đa 30 ngày, hoặc tới khi bạn đăng xuất.",
            "Tài khoản liên kết: tới khi bạn hủy liên kết hoặc tài khoản của bạn bị xóa.",
            "Bộ đếm giới hạn (gồm địa chỉ IP): được xóa định kỳ khi hết hạn.",
            "Bản ghi lượt bấm link ra ngoài: xóa sau 13 tháng.",
            "Bản ghi chống đếm trùng theo ngày: xóa sau 2 ngày.",
            "Yêu cầu và tin nhắn: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Yêu cầu bạn chưa xác nhận, và tài khoản tạo cho chúng mà chưa từng xác nhận: xóa sau 48 giờ.",
            "Nhu cầu và đề xuất: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Nhu cầu bạn chưa xác nhận: xóa sau 48 giờ.",
            "Câu hỏi và góp ý: tới khi chúng tôi đã trả lời và xử lý xong, cộng 12 tháng, hoặc tới khi bạn yêu cầu xóa.",
            "Tài khoản, hồ sơ và listing: trong thời gian tài khoản tồn tại. Khi bạn yêu cầu xóa, chúng tôi xóa hoặc ẩn danh, trừ các bản ghi phải giữ theo luật hoặc để bảo vệ trang.",
            "Danh sách chờ: tới khi chợ mở cho client cộng 12 tháng, hoặc tới khi bạn yêu cầu gỡ.",
          ],
        },
      ],
    },
    {
      heading: "7. Quyền của bạn",
      blocks: [
        { p: "Bạn có thể yêu cầu xem, sửa, xuất hoặc xóa dữ liệu cá nhân, rút lại sự đồng ý, hoặc phản đối cách chúng tôi dùng dữ liệu. Gửi email tới contact@vnx.si từ địa chỉ bạn đã dùng với chúng tôi. Chúng tôi trả lời trong 30 ngày. Bạn cũng có thể khiếu nại với cơ quan bảo vệ dữ liệu nơi bạn sống." },
      ],
    },
    {
      heading: "8. Bảo mật",
      blocks: [
        { p: "Phiên và link đăng nhập chỉ được lưu dạng hash, trang chỉ phục vụ qua HTTPS, và thao tác của admin được ghi lại. Chúng tôi gửi email cho bạn mỗi khi có tài khoản được liên kết hoặc hủy liên kết với tài khoản của bạn. Không hệ thống nào an toàn tuyệt đối; hãy báo cho chúng tôi qua contact@vnx.si nếu bạn phát hiện vấn đề." },
      ],
    },
    {
      heading: "9. Trẻ em",
      blocks: [
        { p: "VNX.SI không dành cho trẻ em. Bạn phải từ 16 tuổi để vào danh sách chờ và từ 18 tuổi để làm builder." },
      ],
    },
    {
      heading: "10. Thay đổi",
      blocks: [
        { p: "Khi thay đổi chính sách này, chúng tôi cập nhật ngày ở trên. Với thay đổi quan trọng, chúng tôi báo cho người dùng đã đăng nhập trước khi có hiệu lực." },
      ],
    },
    {
      heading: "11. Ngôn ngữ",
      blocks: [
        { p: "Nếu bản dịch khác bản tiếng Anh, bản tiếng Anh được áp dụng." },
      ],
    },
  ],
};

const mediaKitEn: LegalDoc = {
  title: "Media kit",
  sections: [
    {
      heading: "About VNX.SI",
      blocks: [
        { p: "VNX.SI is the marketplace for AI-built products and the people who build them. Builders list software they built with AI tools; people who need software can buy a product, have it customized, hire the builder, or ask for something similar." },
      ],
    },
    {
      heading: "Who it is for",
      blocks: [
        {
          ul: [
            "Small business owners, starting in Vietnam, who need software that works now, with clear prices.",
            "International and Chinese-speaking clients looking for niche software and builders they can trust.",
            "Independent builders and small studios who want a channel to sell what they build and to get custom work.",
          ],
        },
        { p: "The site is available in English, Vietnamese, Simplified Chinese and Traditional Chinese." },
      ],
    },
    {
      heading: "What we stand for",
      blocks: [
        {
          ul: [
            "Rankings are never for sale.",
            "Badges say exactly what was checked: Listed, Demo verified, In production. No stars, no made-up scores.",
            "We only publish numbers that come from real data.",
          ],
        },
      ],
    },
    {
      heading: "Working with partners",
      blocks: [
        { p: "We feature tools that builders and clients actually use, on dedicated tool pages. Partner and affiliate links are clearly disclosed, and a commission never changes how products are ranked. To discuss a partnership, email contact@vnx.si." },
      ],
    },
    {
      heading: "Brand",
      blocks: [
        {
          ul: [
            "Name: write **VNX.SI** (capitals, with the dot). Do not write \"VNX\", \"Vnx.si\" or \"VNXSI\".",
            "Colours: ink `#0D1526`, accent blue `#1D4ED8`, background `#F4F5F7`.",
            "Fonts: Space Grotesk (headings), Be Vietnam Pro (text).",
            "Logo files: `/assets/brand/vnxsi-mark.svg` (light backgrounds), `/assets/brand/vnxsi-mark-dark.svg` (dark backgrounds), `/assets/brand/vnxsi-icon.svg` (app icon). Keep clear space around the mark at least the size of its blue dot; do not recolour, rotate or stretch it.",
          ],
        },
      ],
    },
    {
      heading: "Contact",
      blocks: [
        { p: "Press and partnerships: contact@vnx.si" },
      ],
    },
  ],
};

const mediaKitVi: LegalDoc = {
  title: "Media kit",
  sections: [
    {
      heading: "Về VNX.SI",
      blocks: [
        { p: "VNX.SI là chợ cho sản phẩm xây bằng AI và những người xây chúng. Builder đăng phần mềm họ xây bằng công cụ AI; người cần phần mềm có thể mua sản phẩm, nhờ tùy chỉnh, thuê builder, hoặc yêu cầu một sản phẩm tương tự." },
      ],
    },
    {
      heading: "Dành cho ai",
      blocks: [
        {
          ul: [
            "Chủ doanh nghiệp nhỏ, bắt đầu từ Việt Nam, cần phần mềm chạy được ngay, giá rõ ràng.",
            "Khách quốc tế và khách nói tiếng Hoa cần phần mềm ngách và builder đáng tin.",
            "Builder độc lập và studio nhỏ cần kênh bán sản phẩm mình xây và nhận việc tùy chỉnh.",
          ],
        },
        { p: "Trang có tiếng Anh, tiếng Việt, tiếng Trung giản thể và phồn thể." },
      ],
    },
    {
      heading: "Điều chúng tôi giữ",
      blocks: [
        {
          ul: [
            "Thứ hạng không bao giờ được bán.",
            "Huy hiệu nói đúng những gì đã kiểm: Listed, Demo verified, In production. Không chấm sao, không điểm số bịa.",
            "Chúng tôi chỉ công bố con số lấy từ dữ liệu thật.",
          ],
        },
      ],
    },
    {
      heading: "Hợp tác với partner",
      blocks: [
        { p: "Chúng tôi giới thiệu những công cụ mà builder và client thật sự dùng, trên các trang công cụ riêng. Link partner và affiliate được ghi rõ, và hoa hồng không bao giờ thay đổi cách xếp hạng sản phẩm. Để trao đổi hợp tác, email contact@vnx.si." },
      ],
    },
    {
      heading: "Thương hiệu",
      blocks: [
        {
          ul: [
            "Tên: viết **VNX.SI** (chữ in hoa, có dấu chấm). Không viết \"VNX\", \"Vnx.si\" hay \"VNXSI\".",
            "Màu: chữ `#0D1526`, xanh nhấn `#1D4ED8`, nền `#F4F5F7`.",
            "Font: Space Grotesk (tiêu đề), Be Vietnam Pro (nội dung).",
            "File logo: `/assets/brand/vnxsi-mark.svg` (nền sáng), `/assets/brand/vnxsi-mark-dark.svg` (nền tối), `/assets/brand/vnxsi-icon.svg` (biểu tượng app). Chừa khoảng trống quanh logo ít nhất bằng chấm xanh; không đổi màu, xoay hay kéo giãn.",
          ],
        },
      ],
    },
    {
      heading: "Liên hệ",
      blocks: [
        { p: "Báo chí và hợp tác: contact@vnx.si" },
      ],
    },
  ],
};

const disclosureEn: LegalDoc = {
  title: "Disclosure",
  sections: [
    {
      heading: "1. Partner links",
      blocks: [
        { p: "Some links on VNX.SI lead to products or services of other companies through a partner or affiliate program. If you sign up or buy through one of these links, VNX.SI may earn a commission from that company. Pages with such links say so next to the link, and the links are marked `rel=\"sponsored\"` for search engines. When you follow a link we record the click; our Privacy Policy says what the record contains." },
      ],
    },
    {
      heading: "2. Rankings are not for sale",
      blocks: [
        { p: "A commission never changes how products or builders are ranked: not in search, not in the directory, not in Trending or the Top lists, and not in which builders we suggest for a request. Nobody can pay for a higher position, and the code that ranks results does not read partner or commission data." },
      ],
    },
    {
      heading: "3. Companies with an active partner program",
      blocks: [{ p: "The companies below have an active partner program with VNX.SI." }],
    },
    { heading: "4. Questions", blocks: [{ p: "Email contact@vnx.si." }] },
  ],
};

const disclosureVi: LegalDoc = {
  title: "Công khai quan hệ đối tác",
  sections: [
    {
      heading: "1. Link partner",
      blocks: [
        { p: "Một số link trên VNX.SI dẫn tới sản phẩm hoặc dịch vụ của công ty khác thông qua chương trình partner hoặc affiliate. Nếu bạn đăng ký hoặc mua qua một link như vậy, VNX.SI có thể nhận hoa hồng từ công ty đó. Trang có link như vậy sẽ ghi rõ cạnh link, và các link được đánh dấu `rel=\"sponsored\"` cho công cụ tìm kiếm. Khi bạn bấm một link, chúng tôi ghi lại lượt bấm; Chính sách quyền riêng tư nói rõ bản ghi gồm những gì." },
      ],
    },
    {
      heading: "2. Thứ hạng không bán",
      blocks: [
        { p: "Hoa hồng không bao giờ thay đổi cách xếp hạng sản phẩm hay builder: không trong tìm kiếm, không trong danh bạ, không trong Trending hay các danh sách Top, và không trong việc chúng tôi gợi ý builder nào cho một nhu cầu. Không ai trả tiền để lên vị trí cao hơn, và đoạn mã xếp hạng kết quả không đọc dữ liệu partner hay hoa hồng." },
      ],
    },
    {
      heading: "3. Công ty có chương trình partner đang hoạt động",
      blocks: [{ p: "Các công ty dưới đây có chương trình partner đang hoạt động với VNX.SI." }],
    },
    { heading: "4. Câu hỏi", blocks: [{ p: "Gửi email tới contact@vnx.si." }] },
  ],
};

/** Index of the section "3. …" in disclosureEn / disclosureVi: the active-partner list from the database goes right after it. */
export const DISCLOSURE_PARTNERS_SECTION = 2;

export const LEGAL: Record<LegalPageId, LegalPage> = {
  terms: { rest: "/terms", dated: true, en: termsEn, vi: termsVi },
  privacy: { rest: "/privacy", dated: true, en: privacyEn, vi: privacyVi },
  mediaKit: { rest: "/media-kit", dated: false, en: mediaKitEn, vi: mediaKitVi },
  disclosure: { rest: "/disclosure", dated: true, en: disclosureEn, vi: disclosureVi },
};

/** The Privacy text shown from the start of the notice window (VNX-0701b); `LEGAL.privacy` stays the live text until then. Mirrors docs/legal/privacy-m7.md. */
export const PRIVACY_M7: { en: LegalDoc; vi: LegalDoc } = { en: privacyEnM7, vi: privacyViM7 };
