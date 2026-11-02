Feature: Người dùng
  Hai người dùng chung một sổ, không ai là quản trị. Khi chưa đủ hai người thì mời được người mới; đủ rồi thì không.
  Ai cũng gửi được link khôi phục cho người kia khi họ mất điện thoại. Link chỉ hiện một lần, dùng được một lần, trong
  10 phút. Mời người mới đến tận lúc đặt tên được thử ở unit test (people.test.ts): sổ của bản e2e đã có đủ hai người.

  Scenario: Sổ đã đủ hai người thì không mời thêm
    Given tôi đã đăng nhập
    When tôi mở Cài đặt
    And tôi mở "Người dùng" trong Cài đặt
    Then tôi thấy "Hoa"
    And không có nút "Mời người dùng"
    And trang không có lỗi trợ năng

  # WebKit in Playwright has no passkeys, and the newcomer's first way in is one. Android alone, as every scenario
  # that opens a setup link (sign-in.feature).
  @chromium-only @phone-only
  Scenario: Gửi link khôi phục cho người kia
    Given tôi vừa đăng nhập bằng mật khẩu
    When tôi mở Cài đặt
    And tôi mở "Người dùng" trong Cài đặt
    And tôi tạo link khôi phục cho "Minh"
    Then tôi được hỏi "Tạo link khôi phục cho Minh"
    When người được mời mở link trên máy của họ
    And tôi bấm "Bật ngay"
    Then tôi đang ở trang Hôm nay
