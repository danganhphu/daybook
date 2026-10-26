Feature: Gộp khách
  Hai khách là một: đơn, việc cần nhắc và công nợ về một khách, tên của khách kia thành tên khác của khách này. Hỏi
  lại trước khi gộp, vì không hoàn tác được.

  Background:
    Given tôi đã đăng nhập

  # Adds customers through the form, which WebKit refuses a stylesheet on (known gaps)
  @iphone-later
  Scenario: Gộp một khách vào khách khác
    Given có khách mới "Hoà Bình" với đơn "Bông gòn" giá "20000"
    And có khách mới "chị Bình" với đơn "Bông gòn" giá "30000"
    When tôi gộp khách "chị Bình" vào "Hoà Bình"
    Then tôi thấy thông báo "Đã gộp khách"
    And tôi đang xem khách mới "Hoà Bình"
    And khách này còn nợ "50.000đ"
    And khách này có tên khác "chị Bình"
    And trang không có lỗi trợ năng
