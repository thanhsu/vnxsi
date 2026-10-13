import { describe, expect, it } from "vitest";
import { BOARD_PAGE_SIZE } from "../../src/domain/request-board.ts";
import { PAGE_SIZE } from "../../src/domain/catalog.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { vi } from "../../src/i18n/messages/vi.ts";
import { Pagination } from "../../src/views/Pagination.tsx";
import { BoardPage } from "../../src/views/requests/BoardPage.tsx";
import { RequestCard } from "../../src/views/requests/RequestCard.tsx";

/** VNX-2705a review round 1: the 31 board.* strings the Owner approved (2026-10-12), byte for byte, EN and VI. */
const APPROVED: Record<string, [string, string]> = {
  "board.title": ["Public request board", "Bảng nhu cầu công khai"],
  "board.intro": [
    "Requests that clients chose to make public. Our team reviews each one before it is shown. The client's name, email address and account are never shown.",
    "Các nhu cầu mà người đăng đã chọn công khai. Đội ngũ của chúng tôi xem xét từng nhu cầu trước khi hiện. Tên, email và tài khoản của người đăng không bao giờ được hiện.",
  ],
  "board.empty.title": ["No open requests right now", "Hiện chưa có nhu cầu nào đang mở"],
  "board.empty.body": ["Nothing is listed at the moment. You can post your own request, or browse products in the meantime.", "Hiện chưa có nhu cầu nào trên bảng. Bạn có thể đăng nhu cầu của mình, hoặc xem các sản phẩm trong lúc chờ."],
  "board.cta.post": ["Post a request", "Đăng nhu cầu"],
  "board.cta.products": ["Browse products", "Xem sản phẩm"],
  "board.filter.category": ["Category", "Danh mục"],
  "board.filter.budget": ["Budget", "Ngân sách"],
  "board.filter.language": ["Language", "Ngôn ngữ"],
  "board.filter.any": ["Any", "Tất cả"],
  "board.filter.apply": ["Apply", "Áp dụng"],
  "board.card.posted": ["Posted", "Ngày đăng"],
  "board.card.deadline": ["Deadline", "Hạn chót"],
  "board.deadline.none": ["No deadline", "Không có hạn chót"],
  "board.status.open": ["Open", "Đang mở"],
  "board.status.closed": ["Closed", "Đã đóng"],
  "board.detail.country": ["Country", "Quốc gia"],
  "board.detail.languages": ["Languages", "Ngôn ngữ"],
  "board.detail.budget": ["Budget", "Ngân sách"],
  "board.detail.category": ["Category", "Danh mục"],
  "board.detail.deadline": ["Deadline", "Hạn chót"],
  "board.detail.posted": ["Posted", "Ngày đăng"],
  "board.detail.identityNote": ["The client's identity is not shown. The VNX.SI team invites up to five builders.", "Danh tính của người đăng không được hiện. Đội ngũ VNX.SI mời tối đa năm builder."],
  "board.detail.closedNote": ["This request is no longer open. It stays visible here for a limited time.", "Nhu cầu này không còn mở và chỉ còn hiện ở đây trong một thời gian có hạn."],
  "board.detail.back": ["All requests", "Tất cả nhu cầu"],
  "board.cta.label": ["Next steps", "Bước tiếp theo"],
  "board.cta.signedOut": ["I'm a builder — I'm interested", "Tôi là builder — tôi quan tâm"],
  "board.cta.notBuilder": ["Only approved builders can tell us they are interested in a request.", "Chỉ builder đã được duyệt mới có thể báo với chúng tôi rằng họ quan tâm tới một nhu cầu."],
  "board.cta.pendingBuilder": ["Available once your builder profile is approved.", "Chức năng này mở sau khi hồ sơ builder của bạn được duyệt."],
  "board.cta.ownRequest": ["This is your request. Manage it in your account.", "Đây là nhu cầu của bạn. Quản lý nhu cầu này trong tài khoản của bạn."],
  "board.cta.closed": ["This request is closed.", "Nhu cầu này đã đóng."],
};

/** VNX-2706a R1: the 25 board.interest.* and 7 hub.interests.* strings the Owner approved verbatim (2026-10-13), byte for byte, EN and VI. */
const INTEREST_APPROVED: Record<string, [string, string]> = {
  "board.interest.cta": ["Tell us you're interested", "Báo với chúng tôi rằng bạn quan tâm"],
  "board.interest.intro": ["Only the VNX.SI team sees this. The client does not see it unless we invite you, and it does not create any agreement. Our team decides whom to invite, up to five builders.", "Chỉ đội ngũ VNX.SI thấy thông tin này. Người đăng không thấy, trừ khi chúng tôi mời bạn, và việc này không tạo ra bất kỳ thỏa thuận nào. Đội ngũ của chúng tôi quyết định mời ai, tối đa năm builder."],
  "board.interest.label.note": ["Note (optional)", "Ghi chú (không bắt buộc)"],
  "board.interest.noteHint": ["Up to 500 characters. What you write must be true.", "Tối đa 500 ký tự. Những gì bạn viết phải đúng sự thật."],
  "board.interest.label.product": ["Product (optional)", "Sản phẩm (không bắt buộc)"],
  "board.interest.productHint": ["One of your published products that fits this request.", "Một sản phẩm đã công khai của bạn phù hợp với nhu cầu này."],
  "board.interest.noProduct": ["No product", "Không chọn sản phẩm"],
  "board.interest.submit": ["I'm interested", "Tôi quan tâm"],
  "board.interest.sent": ["You told us you're interested", "Bạn đã báo với chúng tôi rằng bạn quan tâm"],
  "board.interest.waiting": ["Interest sent — waiting for our team. Only the VNX.SI team sees it. If you withdraw it, you cannot tell us you're interested in this request again.", "Đã gửi quan tâm — đang chờ đội ngũ của chúng tôi. Chỉ đội ngũ VNX.SI thấy thông tin này. Nếu rút lại, bạn sẽ không thể báo quan tâm tới nhu cầu này lần nữa."],
  "board.interest.withdraw": ["Withdraw my interest", "Rút lại quan tâm"],
  "board.interest.invited": ["Invited. Our team invited you to this request.", "Đã được mời. Đội ngũ của chúng tôi đã mời bạn tham gia nhu cầu này."],
  "board.interest.invitedLink": ["Open your invitation", "Mở lời mời của bạn"],
  "board.interest.notInvited": ["Not invited. Our team did not invite you to this request.", "Không được mời. Đội ngũ của chúng tôi không mời bạn tham gia nhu cầu này."],
  "board.interest.withdrawn": ["You withdrew your interest in this request. You cannot tell us you're interested in it again.", "Bạn đã rút lại quan tâm tới nhu cầu này. Bạn không thể báo quan tâm tới nhu cầu này lần nữa."],
  "board.interest.notEligible": ["Only approved builders can tell us they are interested in a request, and not in a request they posted themselves.", "Chỉ builder đã được duyệt mới có thể báo với chúng tôi rằng họ quan tâm tới một nhu cầu, và không áp dụng cho nhu cầu do chính họ đăng."],
  "board.interest.rateLimited": ["You can tell us you're interested up to {n} times a day. Try again tomorrow.", "Bạn có thể báo quan tâm tối đa {n} lần mỗi ngày. Hãy thử lại vào ngày mai."],
  "board.interest.capReached": ["You already have {n} interests waiting for our team. Withdraw one to send another.", "Bạn đang có {n} quan tâm chờ đội ngũ của chúng tôi. Hãy rút lại một quan tâm để gửi thêm."],
  "board.interest.closed": ["This request is closed, so we could not record your interest.", "Nhu cầu này đã đóng, nên chúng tôi không ghi nhận được quan tâm của bạn."],
  "board.interest.conflict": ["That did not go through because this request or your interest in it changed in the meantime. Reload the page to see the current status.", "Thao tác không thực hiện được vì nhu cầu này hoặc quan tâm của bạn tới nhu cầu này vừa thay đổi. Hãy tải lại trang để xem trạng thái mới nhất."],
  "board.interest.already": ["You already told us you're interested in this request.", "Bạn đã báo với chúng tôi rằng bạn quan tâm tới nhu cầu này."],
  "board.interest.alreadyInvited": ["Our team already invited you to this request. Your invitation is in Builder Hub.", "Đội ngũ của chúng tôi đã mời bạn tham gia nhu cầu này. Lời mời nằm trong Builder Hub."],
  "board.interest.error.noteTooLong": ["The note is too long. Use at most 500 characters.", "Ghi chú quá dài. Dùng tối đa 500 ký tự."],
  "board.interest.error.noteInvalid": ["The note has characters that are not allowed.", "Ghi chú có ký tự không được phép."],
  "board.interest.error.product": ["Choose one of your published products, or no product.", "Hãy chọn một sản phẩm đã công khai của bạn, hoặc không chọn sản phẩm."],
  "hub.interests.title": ["Requests you're interested in", "Nhu cầu bạn quan tâm"],
  "hub.interests.empty": ["No requests here yet. When you tell us you're interested in a request on the public request board, it appears here.", "Chưa có nhu cầu nào ở đây. Khi bạn báo với chúng tôi rằng bạn quan tâm tới một nhu cầu trên bảng nhu cầu công khai, nhu cầu đó sẽ hiện ở đây."],
  "hub.interests.pending": ["Interest sent — waiting for our team", "Đã gửi quan tâm — đang chờ đội ngũ của chúng tôi"],
  "hub.interests.invited": ["Invited", "Đã được mời"],
  "hub.interests.notInvited": ["Not invited", "Không được mời"],
  "hub.interests.noLongerPublic": ["No longer public", "Không còn công khai"],
  "hub.interests.clicked": ["Sent {date}", "Đã gửi {date}"],
};

describe("approved board copy", () => {
  it("has exactly the 31 approved keys in EN and VI, nothing else under board.*", () => {
    expect(Object.keys(APPROVED)).toHaveLength(31);
    for (const catalogue of [en, vi] as Record<string, string>[]) {
      expect(Object.keys(catalogue).filter((k) => k.startsWith("board.") && !k.startsWith("board.interest.")).sort()).toEqual(Object.keys(APPROVED).sort());
      expect(Object.keys(catalogue).filter((k) => k.startsWith("board.interest.") || k.startsWith("hub.interests.")).sort()).toEqual(Object.keys(INTEREST_APPROVED).sort());
    }
    expect(Object.keys(INTEREST_APPROVED)).toHaveLength(32);
  });

  it("matches the approved EN and VI strings byte for byte", () => {
    for (const [key, [e, v]] of [...Object.entries(APPROVED), ...Object.entries(INTEREST_APPROVED)]) {
      expect((en as Record<string, string>)[key], `en ${key}`).toBe(e);
      expect((vi as Record<string, string>)[key], `vi ${key}`).toBe(v);
    }
  });
});

const item = { publicId: "0".repeat(26), publicTitle: "T", publicDescription: "A description that is long enough for the listing.", publishedAt: "2026-10-05T10:00:00.000Z", category: "booking", budgetBand: "unsure", country: null, languages: ["en"] } as const;
const card = async (deadline: string | null, locale: "en" | "vi" = "en") => String(await (<RequestCard locale={locale} item={{ ...item, deadline }} />));

describe("card dates (L-2)", () => {
  it("no deadline shows only the 'No deadline' wording, and Deadline and Posted are written the same way", async () => {
    const none = await card(null);
    expect(none).toContain("No deadline · Posted: 2026-10-05");
    expect(none).not.toContain("Deadline:");
    expect(await card("2027-05-06")).toContain("Deadline: 2027-05-06 · Posted: 2026-10-05");
    expect(await card(null, "vi")).toContain("Không có hạn chót · Ngày đăng: 2026-10-05");
  });
});

describe("board page rendered directly", () => {
  const query = { category: null, budget: null, lang: null, page: 1 };
  const render = async (items: unknown[], total: number) =>
    String(await (<BoardPage locale="en" origin="https://vnx.si" query={query} items={items as never} total={total} indexable={false} signedIn={false} />));

  it("S-3: no items gives the empty state with both calls to action and no card, and no pager", async () => {
    const html = await render([], 0);
    expect(html).toContain("No open requests right now");
    expect(html).toContain('href="/request"');
    expect(html).toContain('href="/products"');
    expect(html).not.toContain('class="cards"');
    expect(html).not.toContain('class="pager"');
  });

  it("S-2: the pager counts pages by the board's page size", async () => {
    expect(BOARD_PAGE_SIZE).toBe(PAGE_SIZE);
    const html = await render([item], BOARD_PAGE_SIZE + 1);
    expect(html).toContain('class="pager"');
    expect(html).toContain("/requests?page=2");
    expect(await render([item], BOARD_PAGE_SIZE)).not.toContain('class="pager"');
  });

  it("S-2: Pagination takes a page size of its own", async () => {
    const html = String(await (<Pagination locale="en" path="/x" page={1} total={25} pageSize={10} href={(n) => `?page=${n}`} />));
    expect(html).toContain("/x?page=2");
    expect(String(await (<Pagination locale="en" path="/x" page={1} total={25} href={(n) => `?page=${n}`} />))).toContain("/x?page=2");
    expect(String(await (<Pagination locale="en" path="/x" page={1} total={10} pageSize={10} href={(n) => `?page=${n}`} />))).not.toContain("pager");
  });
});
