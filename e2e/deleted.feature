Feature: Đã xoá gần đây
  Mọi thứ đã xoá nằm đây 30 ngày, mới nhất trước: khôi phục hoặc xoá vĩnh viễn từng mục, hay chọn nhiều mục một lần.
  Xoá vĩnh viễn thì hỏi trước, và không khôi phục được nữa.

  Background:
    Given tôi đã đăng nhập

  Scenario: Khôi phục một ghi chú đã xoá
    Given hôm nay chỉ có ghi chú "Hỏi giá máy cạo vôi"
    When tôi xoá ghi chú "Hỏi giá máy cạo vôi"
    Then tôi thấy thông báo "Đã xoá ghi chú"
    When tôi mở Đã xoá gần đây từ Cài đặt
    Then trang không có lỗi trợ năng
    When tôi khôi phục "Hỏi giá máy cạo vôi"
    Then tôi thấy thông báo "Đã khôi phục"
    When tôi mở trang Hôm nay
    Then ghi chú "Hỏi giá máy cạo vôi" hiện trong hôm nay

  Scenario: Xoá vĩnh viễn một ghi chú
    Given tôi ghi rồi xoá ghi chú riêng "Mẫu thử composite"
    When tôi mở Đã xoá gần đây từ Cài đặt
    And tôi xoá vĩnh viễn ghi chú riêng "Mẫu thử composite"
    Then tôi thấy thông báo "Đã xoá vĩnh viễn"
    And Đã xoá gần đây không còn ghi chú riêng "Mẫu thử composite"

  Scenario: Chọn nhiều mục rồi khôi phục một lần
    Given tôi ghi rồi xoá ghi chú riêng "Gửi báo giá trám răng"
    And tôi ghi rồi xoá ghi chú riêng "Hẹn giao găng tay"
    When tôi mở Đã xoá gần đây từ Cài đặt
    And tôi chọn các ghi chú riêng "Gửi báo giá trám răng" và "Hẹn giao găng tay"
    Then trang không có lỗi trợ năng
    When tôi bấm "Khôi phục"
    Then tôi thấy thông báo "Đã khôi phục 2 mục"
    And ghi chú riêng "Gửi báo giá trám răng" hiện trong hôm nay
    And ghi chú riêng "Hẹn giao găng tay" hiện trong hôm nay

  # Adds a customer through the form, which WebKit refuses a stylesheet on (known gaps)
  @iphone-later
  Scenario: Xoá một khách cùng đơn của họ rồi khôi phục
    Given có khách mới "Nha khoa Thảo Điền" với đơn "Bông gòn" giá "20000"
    When tôi mở khách mới "Nha khoa Thảo Điền"
    And tôi chọn "Xoá khách" trong menu của khách này
    Then tôi được hỏi "Xoá khách này?"
    And câu hỏi có nói "Kèm 1 đơn"
    When tôi trả lời "Xoá"
    Then tôi thấy thông báo "Đã xoá khách"
    When tôi mở Đã xoá gần đây từ Cài đặt
    Then trong Đã xoá gần đây khách "Nha khoa Thảo Điền" có dòng "kèm 1 đơn"
    When tôi khôi phục khách "Nha khoa Thảo Điền"
    Then tôi thấy thông báo "Đã khôi phục"
    When tôi mở khách mới "Nha khoa Thảo Điền"
    Then khách này còn nợ "20.000đ"
