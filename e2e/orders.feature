Feature: Đơn hàng
  Tạo đơn từ trang khách: gõ tên hàng (mới hoặc có sẵn), số lượng, giá; tổng tự cộng. Thu tiền, đánh dấu đã giao,
  mỗi thay đổi ghi vào lịch sử. Danh sách theo tháng có tổng doanh số, đã thu, còn nợ.

  Background:
    Given tôi đã đăng nhập

  Scenario: Tạo đơn với món mới
    When tôi tạo đơn cho khách "Sao Mai" gồm:
      | món                | số lượng | đơn giá |
      | Thuốc tê Lidocaine | 2        | 425000  |
      | Ống hút nước bọt   | 10       | 5000    |
    Then đơn có tổng "900.000đ" và còn nợ "900.000đ"
    And lịch sử đơn có "Tạo đơn"
    And trang không có lỗi trợ năng

  Scenario: Tạo đơn ở trang Đơn hàng, chọn khách trong gợi ý
    When tôi tạo đơn ở trang Đơn hàng, gõ "sao" rồi chọn khách "Sao Mai", gồm:
      | món      | số lượng | đơn giá |
      | Bông gòn | 2        | 20000   |
    Then đơn là của khách "Sao Mai"
    And đơn có tổng "40.000đ" và còn nợ "40.000đ"

  @iphone-later
  Scenario: Thu đủ tiền và giao hàng
    When tôi tạo đơn cho khách "Sao Mai" gồm:
      | món      | số lượng | đơn giá |
      | Bông gòn | 3        | 20000   |
    And tôi thu "60000"
    And tôi đánh dấu đã giao hôm nay
    Then đơn có tổng "60.000đ" và còn nợ "0đ"
    And lịch sử đơn có "Thu tiền"
    And lịch sử đơn có "Đã giao"

  @iphone-later
  Scenario: Thu nhiều hơn số còn nợ thì không được
    When tôi tạo đơn cho khách "Sao Mai" gồm:
      | món      | số lượng | đơn giá |
      | Bông gòn | 1        | 20000   |
    And tôi thu "30000"
    Then ô "Số tiền (đ)" báo "Số tiền thu nhiều hơn số còn nợ."

  Scenario: Danh sách đơn trong tháng
    When tôi mở trang Đơn hàng
    Then có đơn của "Hướng Dương" giá "800.000đ"
    And trang không có lỗi trợ năng
    When tôi chọn "Còn nợ"
    Then có đơn của "Hướng Dương" giá "800.000đ"
