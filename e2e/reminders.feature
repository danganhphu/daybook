Feature: Việc cần nhắc
  Thêm việc cần nhắc ở trang Việc cần nhắc, trên trang một khách, hoặc từ một ghi chú. Việc đến hạn hiện ngay dưới đầu
  trang Hôm nay; xong bằng một chạm, có Hoàn tác.

  Background:
    Given tôi đã đăng nhập
    And chưa có việc cần nhắc nào

  Scenario: Thêm việc cho hôm nay, rồi thấy nó trên Hôm nay
    When tôi thêm việc cần nhắc "Gọi nha khoa Sao Mai hỏi lịch giao" cho hôm nay
    Then có việc "Gọi nha khoa Sao Mai hỏi lịch giao" trong nhóm "Hôm nay"
    And trang không có lỗi trợ năng
    When tôi mở trang Hôm nay
    Then Hôm nay nhắc "Gọi nha khoa Sao Mai hỏi lịch giao"
    And trang không có lỗi trợ năng

  Scenario: Xong bằng một chạm, rồi hoàn tác
    Given có việc cần nhắc "Mang mẫu găng tay" cho hôm nay
    When tôi đánh dấu xong việc "Mang mẫu găng tay"
    Then tôi thấy thông báo "Đã xong"
    And không còn việc "Mang mẫu găng tay"
    When tôi bấm "Hoàn tác"
    Then có việc "Mang mẫu găng tay" trong nhóm "Hôm nay"

  Scenario: Việc quá hạn nói trễ bao lâu
    When tôi thêm việc cần nhắc "Thu tiền đơn tuần trước" hạn 2 ngày trước
    Then có việc "Thu tiền đơn tuần trước" trong nhóm "Quá hạn"
    And việc "Thu tiền đơn tuần trước" ghi "Quá hạn 2 ngày"

  Scenario: Chọn khách trong gợi ý khi thêm việc
    When tôi thêm việc cần nhắc "Hỏi lịch giao bông gòn" cho hôm nay, gõ "sao" rồi chọn khách "Sao Mai"
    Then việc "Hỏi lịch giao bông gòn" ghi "Sao Mai"

  Scenario: Thêm trên trang một khách
    When tôi mở trang khách "Hướng Dương"
    And tôi thêm việc cần nhắc "Mang mẫu kim mới" ở trang khách cho ngày mai
    Then việc "Mang mẫu kim mới" ghi "Ngày mai"
    And trang không có lỗi trợ năng

  Scenario: Biến một ghi chú thành việc cần nhắc
    Given hôm nay chỉ có ghi chú "nha khoa Minh Châu hẹn gọi lại thứ 5"
    When tôi nhắc việc từ ghi chú "nha khoa Minh Châu hẹn gọi lại thứ 5" cho ngày mai
    And tôi mở trang Việc cần nhắc
    Then có việc "nha khoa Minh Châu hẹn gọi lại thứ 5" trong nhóm "Ngày mai"
