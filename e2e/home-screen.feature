Feature: Cài lên màn hình chính
  Bạn ấy thêm daybook vào màn hình chính điện thoại, không qua chợ ứng dụng, rồi mở nó như một app:
  có tên, có icon, không có thanh địa chỉ.

  @chromium-only
  Scenario: Chrome cài được như một app
    When tôi mở trang Hôm nay
    Then Chrome cho cài trang thành app "daybook"

  Scenario: Icon và tên cho màn hình chính
    When tôi mở trang Hôm nay
    Then mọi icon trong manifest tải được và đúng cỡ đã khai
    And trang có icon 180px cho màn hình chính iPhone
    And tên dưới icon trên iPhone là "daybook"
