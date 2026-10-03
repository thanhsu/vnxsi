# <TASK-ID> — Handoff cho Implementer

- **Plan đã duyệt:** <đường dẫn>
- **Báo cáo phải nộp:** `.ai/tasks/<TASK-ID>-report.md`

## Mục tiêu

<1 câu>

## Phạm vi đã duyệt

- …

## Ngoài phạm vi (không làm)

- …

## Đọc trước

- <spec mục …>, <ADR …>, <file code liên quan>

## File dự kiến bị ảnh hưởng

- …

## Ảnh hưởng DB / API / UI

- …

## Quy tắc nghiệp vụ

- …

## Tiêu chí chấp nhận

Mỗi tiêu chí kiểm được bằng một lệnh.

- [ ] AC1: … — `npm test -- <file>`

## Test bắt buộc

- …

## Lệnh kiểm tra

```bash
npm run typecheck -w apps/web
npm test
```

## Cấm

- Không sửa ngoài danh sách file trừ khi bắt buộc; nếu phải sửa, ghi lý do trong báo cáo.
- Không thêm dependency ngoài danh sách đã duyệt.
