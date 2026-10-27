Feature: Người dùng
  Hai người dùng chung, không ai là quản trị. Ai cũng mời được người mới, và gửi được link khôi phục cho người kia khi
  họ mất điện thoại. Link chỉ hiện một lần, dùng được một lần, trong 10 phút.

  # WebKit in Playwright has no passkeys, and the newcomer's first way in is one
  @chromium-only
  Scenario: Mời một người mới
    Given tôi vừa đăng nhập bằng mật khẩu
    When tôi mở Cài đặt
    And tôi mở "Người dùng" trong Cài đặt
    And tôi mời một người dùng mới
    Then tôi được hỏi "Link mời"
    And trang không có lỗi trợ năng
    When người được mời mở link trên máy của họ
    Then họ được hỏi tên
    And trang không có lỗi trợ năng
    When họ chọn tên "Hoa" và một tên đăng nhập chưa ai dùng
    And tôi bấm "Bật ngay"
    Then tôi thấy "Đặt mật khẩu dự phòng"
    When tôi bấm "Để sau"
    Then tôi đang ở trang Hôm nay

  @chromium-only
  Scenario: Gửi link khôi phục cho người kia
    Given tôi vừa đăng nhập bằng mật khẩu
    When tôi mở Cài đặt
    And tôi mở "Người dùng" trong Cài đặt
    And tôi tạo link khôi phục cho "Minh"
    Then tôi được hỏi "Tạo link khôi phục cho Minh"
    When người được mời mở link trên máy của họ
    And tôi bấm "Bật ngay"
    Then tôi đang ở trang Hôm nay
