Feature: Cài lên màn hình chính
  Bạn ấy thêm daybook ra màn hình chính điện thoại, không cần App Store hay CH Play, rồi mở như một app:
  có tên, có icon, không có thanh địa chỉ.

  Background:
    Given tôi đã đăng nhập

  @chromium-only
  Scenario: Chrome cài được như một app
    When tôi mở trang Hôm nay
    Then Chrome cho cài trang thành app "daybook"

  Scenario: Icon và tên cho màn hình chính
    When tôi mở trang Hôm nay
    Then mọi icon trong manifest tải được và đúng cỡ đã khai
    And trang có icon 180px cho màn hình chính iPhone
    And tên dưới icon trên iPhone là "daybook"
