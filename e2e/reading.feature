Feature: Đọc tin
  Gõ như nhắn tin cho người khác. Ghi chú lưu ngay, rồi được đọc: tin bán hàng thành đơn, tin hẹn việc thành việc cần
  nhắc, có Hoàn tác. Tên khách không có trong danh sách thì hỏi ngay trên ghi chú; đọc không được thì ghi chú vẫn là
  ghi chú, và đọc lại được. Bản build e2e không gọi model: một bảng câu trả lời soạn sẵn đứng thay (e2e/readings.ts).

  Background:
    Given tôi đã đăng nhập
    And hôm nay chưa có ghi chú nào

  Scenario: Tin bán hàng thành đơn, rồi hoàn tác
    When tôi gõ "bán 2 hộp thuốc tê cho đại lý Sao Mai 500k" và gửi
    Then ghi chú "bán 2 hộp thuốc tê cho đại lý Sao Mai 500k" ghi "Sao Mai: thuốc tê x2, 500.000đ"
    And tôi thấy thông báo "Đã ghi đơn"
    And trang không có lỗi trợ năng
    When tôi bấm "Hoàn tác"
    Then ghi chú "bán 2 hộp thuốc tê cho đại lý Sao Mai 500k" không còn ghi gì thêm

  Scenario: Mở đơn vừa ghi từ ghi chú
    When tôi gõ "bán 2 hộp thuốc tê cho đại lý Sao Mai 500k" và gửi
    And tôi mở đơn vừa ghi từ ghi chú "bán 2 hộp thuốc tê cho đại lý Sao Mai 500k"
    Then đơn là của khách "Sao Mai"
    And đơn có tổng "500.000đ" và còn nợ "500.000đ"

  Scenario: Tin hẹn việc thành việc cần nhắc
    When tôi gõ "mai gọi đại lý Sao Mai hỏi lịch giao" và gửi
    Then ghi chú "mai gọi đại lý Sao Mai hỏi lịch giao" ghi "Đã đặt nhắc Ngày mai"
    When tôi mở việc vừa nhắc từ ghi chú "mai gọi đại lý Sao Mai hỏi lịch giao"
    Then có việc "mai gọi đại lý Sao Mai hỏi lịch giao" trong nhóm "Ngày mai"

  Scenario: Tên khách lạ thì hỏi, chọn khách trong danh sách
    When tôi gõ "bán 1 hộp kim nha khoa cho chị Lan 400k" và gửi
    Then ghi chú "bán 1 hộp kim nha khoa cho chị Lan 400k" ghi 'Chưa có khách "chị Lan" trong danh sách.'
    And trang không có lỗi trợ năng
    When tôi chọn khách "Sao Mai" cho ghi chú "bán 1 hộp kim nha khoa cho chị Lan 400k", gõ "sao"
    Then ghi chú "bán 1 hộp kim nha khoa cho chị Lan 400k" ghi "Sao Mai: Kim nha khoa, 400.000đ"

  Scenario: Không phải đơn thì để là ghi chú
    When tôi gõ "chị Lan lấy 2 hộp găng tay 90k" và gửi
    And tôi bấm "Không phải đơn" ở ghi chú "chị Lan lấy 2 hộp găng tay 90k"
    Then ghi chú "chị Lan lấy 2 hộp găng tay 90k" không còn ghi gì thêm

  Scenario: Đọc không được thì vẫn là ghi chú, đọc lại được
    When tôi gõ "tin này đọc không được" và gửi
    Then ghi chú "tin này đọc không được" ghi "Chưa đọc được tin này."
    And trang không có lỗi trợ năng
    When tôi bấm "Đọc lại" ở ghi chú "tin này đọc không được"
    Then ghi chú "tin này đọc không được" ghi "Chưa đọc được tin này."

  Scenario: Hết lượt đọc trong ngày thì nói khi nào đọc lại được
    When tôi gõ "hôm nay hết lượt đọc" và gửi
    Then ghi chú "hôm nay hết lượt đọc" ghi "Từ 7 giờ sáng mai đọc lại được."
