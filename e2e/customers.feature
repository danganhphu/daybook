Feature: Khách hàng
  Danh sách khách kèm số còn nợ, tìm không cần gõ dấu, lọc theo loại khách, mỗi khách một trang.

  Background:
    Given tôi đã đăng nhập

  Scenario: Danh sách khách và số còn nợ
    When tôi mở trang Khách hàng
    Then khách "Hướng Dương" còn nợ "800.000đ"
    And trang không có lỗi trợ năng

  Scenario: Tìm khách không cần gõ dấu
    When tôi mở trang Khách hàng
    And tôi tìm khách "huong duong"
    Then có khách "Hướng Dương"
    And không có khách "Sao Mai"

  Scenario: Lọc theo loại khách
    When tôi mở trang Khách hàng
    And tôi chọn loại "Đại lý"
    Then có khách "Sao Mai"
    And không có khách "Hướng Dương"

  @iphone-later
  Scenario: Thêm khách mới
    When tôi thêm khách "Bình Minh" ở "Quận 7", loại "Nha khoa"
    Then tôi đang xem khách "Bình Minh"
    And trang không có lỗi trợ năng

  @iphone-later
  Scenario: Tên khách để trống thì không lưu
    When tôi thêm khách "" ở "Quận 7", loại "Nha khoa"
    Then ô "Tên khách" báo "Chưa nhập tên khách"
