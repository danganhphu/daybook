Feature: Đăng nhập
  Chỉ hai người dùng chung một sổ. Ai chưa đăng nhập chỉ thấy trang đăng nhập. Lần đầu bật Face ID hoặc vân tay
  từ link cài đặt, sau đó đăng nhập bằng một chạm.

  Scenario: Chưa đăng nhập thì chỉ thấy trang đăng nhập
    Given tôi chưa đăng nhập
    When tôi mở trang "/"
    Then tôi đang ở trang đăng nhập
    And trang không có lỗi trợ năng

  Scenario: Trang web khác không gửi được gì vào sổ
    Given tôi đã đăng nhập
    Then một trang web khác không gửi được ghi chú vào daybook

  # WebKit in Playwright has no passkeys, so it shows "not supported" before it ever reads the link
  @chromium-only
  Scenario: Link cài đặt không có thật
    When tôi mở một link cài đặt không có thật
    Then tôi thấy "Link này không còn dùng được. Hãy xin link mới."
    And trang không có lỗi trợ năng

  @chromium-only
  Scenario: Bật Face ID từ link cài đặt, rồi đăng nhập lại bằng nó
    Given máy này có Face ID
    When tôi mở link cài đặt mới
    And tôi bấm "Bật ngay"
    Then tôi đang ở trang Hôm nay
    When tôi đăng xuất
    Then tôi đang ở trang đăng nhập
    And trang không có lỗi trợ năng
    When tôi bấm "Đăng nhập"
    Then tôi đang ở trang Hôm nay

  @chromium-only
  Scenario: Để trang đăng nhập lâu rồi mới bấm vẫn vào được
    Given tôi chưa đăng nhập
    And máy này có Face ID của Hoa
    When tôi mở trang đăng nhập rồi để đó 5 phút
    And tôi bấm "Đăng nhập"
    Then tôi đang ở trang Hôm nay
