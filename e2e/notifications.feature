Feature: Thông báo
  App tự nhắc trước: việc cần làm mỗi sáng và tổng kết thứ Sáu, gửi tới những máy đã bật thông báo. Mỗi người tự chọn
  giờ của mình. Thay đổi về đăng nhập thì luôn được báo. Thông báo nào cũng nằm lại sau cái chuông ở đầu các tab.

  # @iphone-later: WebKit refuses a stylesheet on this screen, as on the other screens with a select (known gaps)
  @iphone-later
  Scenario: Đổi giờ nhắc
    Given tôi đã đăng nhập
    When tôi mở Cài đặt
    And tôi mở "Thông báo" trong Cài đặt
    Then trang không có lỗi trợ năng
    When tôi chọn "06:45" cho "Nhắc việc buổi sáng"
    Then tôi thấy thông báo "Đã lưu giờ nhắc"
    When tôi mở lại màn này
    Then "Nhắc việc buổi sáng" đang là "06:45"
    When tôi chọn "Tắt" cho "Tổng kết thứ Sáu"
    Then tôi thấy thông báo "Đã lưu giờ nhắc"
    When tôi chọn "07:30" cho "Nhắc việc buổi sáng"
    And tôi chọn "17:00" cho "Tổng kết thứ Sáu"
    And tôi mở lại màn này
    Then "Nhắc việc buổi sáng" đang là "07:30"
    And "Tổng kết thứ Sáu" đang là "17:00"

  Scenario: Xem lại thông báo ở cái chuông
    Given tôi đã đăng nhập
    And tôi có một thông báo mới "Có thêm một thiết bị nhận thông báo"
    Then cái chuông báo có thông báo chưa đọc
    When tôi mở cái chuông
    Then thông báo "Có thêm một thiết bị nhận thông báo" đang tô là chưa đọc
    And trang không có lỗi trợ năng
    When tôi bấm quay lại
    Then cái chuông không còn số chưa đọc

  # The app's service worker, served with its own headers by the production build, shows what a push carries. The
  # push is handed to it over the DevTools protocol: no push service is ever called.
  @chromium-only @desktop-only
  Scenario: Máy hiện thông báo app gửi tới
    Given tôi đã đăng nhập
    And trình duyệt này đã cài phần nhận thông báo của app
    When app gửi tới trình duyệt này "Hôm nay có 3 việc"
    Then trình duyệt hiện thông báo "Hôm nay có 3 việc"
