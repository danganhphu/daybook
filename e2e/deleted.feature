Feature: Đã xoá gần đây
  Đơn, ghi chú và việc cần nhắc xoá trong 30 ngày qua, sau khi thông báo Hoàn tác đã tắt: khôi phục từ Cài đặt.

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
