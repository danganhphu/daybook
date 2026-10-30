Feature: Sản phẩm
  Danh sách sản phẩm mở từ trang Đơn hàng: thêm, đổi tên, ẩn, hiện lại. Bấm một dòng của đơn thì mở sản phẩm đó.

  Background:
    Given tôi đã đăng nhập

  Scenario: Thêm, đổi tên, ẩn rồi hiện lại một sản phẩm
    When tôi mở trang Sản phẩm từ trang Đơn hàng
    Then trang không có lỗi trợ năng
    When tôi thêm sản phẩm "Gạc vô trùng"
    Then tôi đang xem sản phẩm mới "Gạc vô trùng"
    When tôi đổi tên sản phẩm thành "Gạc vô trùng 5x5"
    Then tôi đang xem sản phẩm mới "Gạc vô trùng 5x5"
    When tôi ẩn sản phẩm này
    Then tôi thấy "Sản phẩm này đang ẩn: không hiện khi ghi đơn, đơn cũ vẫn giữ."
    When tôi hiện lại sản phẩm này
    Then tôi thấy thông báo "Đã hiện lại sản phẩm"
    And trang không có lỗi trợ năng

  Scenario: Từ một dòng của đơn mở trang sản phẩm
    When tôi mở đơn của "Hướng Dương" giá "800.000đ"
    And tôi bấm vào sản phẩm "Kim nha khoa"
    Then tôi đang xem sản phẩm "Kim nha khoa" có đơn của "Hướng Dương"
    And trang không có lỗi trợ năng

  Scenario: Sản phẩm đã có trong đơn thì chỉ ẩn được, không xoá
    When tôi mở đơn của "Hướng Dương" giá "800.000đ"
    And tôi bấm vào sản phẩm "Kim nha khoa"
    Then tôi đang xem sản phẩm "Kim nha khoa" có đơn của "Hướng Dương"
    When tôi xoá sản phẩm này
    Then tôi được hỏi "Không xoá được sản phẩm này"
    And câu hỏi có nói "Ẩn để các đơn cũ vẫn giữ tên"
    And trang không có lỗi trợ năng
    When tôi trả lời "Huỷ"
    Then tôi đang xem sản phẩm "Kim nha khoa" có đơn của "Hướng Dương"

  Scenario: Xoá một sản phẩm chưa bán rồi hoàn tác
    When tôi mở trang Sản phẩm từ trang Đơn hàng
    And tôi thêm sản phẩm "Đài cắt nha"
    And tôi xoá sản phẩm này
    Then tôi được hỏi "Xoá sản phẩm này?"
    When tôi trả lời "Xoá"
    Then tôi thấy thông báo "Đã xoá sản phẩm"
    When tôi bấm "Hoàn tác"
    Then tôi thấy thông báo "Đã khôi phục"
