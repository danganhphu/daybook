Feature: Xem lại ngày cũ và tìm ghi chú
  Bạn ấy lùi về hôm qua để xem lại, hoặc gõ vài chữ để tìm một ghi chú cũ, có dấu hay không dấu đều được.
  Ngày cũ chỉ để xem và sửa, không có ô ghi mới.

  Background:
    Given tôi đã đăng nhập

  Scenario: Lùi về hôm qua
    When tôi mở trang Hôm nay
    And tôi lùi về ngày trước
    Then tôi đang xem "Hôm qua"
    And có ghi chú "Hẹn giao kim tiêm cho nha khoa Hướng Dương"
    And không có ô ghi chú mới
    And trang không có lỗi trợ năng

  Scenario: Tìm ghi chú không cần gõ dấu
    When tôi tìm "huong duong"
    Then có ghi chú "Hẹn giao kim tiêm cho nha khoa Hướng Dương"
    And trang không có lỗi trợ năng
    When tôi mở ngày có ghi chú "Hẹn giao kim tiêm cho nha khoa Hướng Dương"
    Then tôi đang xem "Hôm qua"

  Scenario: Tìm không thấy
    When tôi tìm "không có chữ này đâu"
    Then tôi thấy "Không tìm thấy ghi chú nào"

  Scenario: Ngày chưa tới thì về Hôm nay
    When tôi mở trang của ngày mai
    Then tôi đang ở trang Hôm nay
