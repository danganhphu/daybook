Feature: Telegram
  Bot Telegram là cửa thứ hai vào sổ, ngang với web: kết nối trong Cài đặt, rồi nhắn như ghi chú. Tin nhắn vào sổ ngay,
  được đọc sau, và bot trả lời bằng một thẻ. Người lạ không ghi được gì. Bản build e2e không gọi Telegram: một Bot API
  giả đứng thay (e2e/telegram-stub.ts) và ghi lại mọi thứ app gửi.

  Scenario: Kết nối Telegram từ Cài đặt, rồi ngắt kết nối
    Given tôi đã đăng nhập từ lâu
    When tôi mở Cài đặt
    And tôi mở "Telegram" trong Cài đặt
    And tôi bấm "Kết nối"
    Then tôi được hỏi "Xác nhận lại"
    When tôi xác nhận bằng mật khẩu của Lan
    Then tôi thấy nút "Mở Telegram" dẫn tới bot
    And trang không có lỗi trợ năng
    When Lan bấm Bắt đầu trong Telegram
    Then bot trả lời Lan "Đã kết nối với tài khoản Lan"
    When tôi quay lại trang
    Then tôi thấy "Đã kết nối: Lan Nguyễn"
    When tôi bấm "Ngắt kết nối"
    And tôi đồng ý "Ngắt kết nối" khi được hỏi "Ngắt kết nối Telegram?"
    Then tôi thấy thông báo "Đã ngắt kết nối Telegram"
    And tôi thấy "Chưa kết nối"

  @desktop-only
  Scenario: Tin nhắn Telegram vào sổ, rồi bot trả lời bằng thẻ đơn
    Given tôi đã đăng nhập
    And hôm nay chưa có ghi chú nào
    When Hoa nhắn bot "bán 3 hộp găng tay cho đại lý Sao Mai 270k"
    Then bot đang gõ cho Hoa
    And bot gửi Hoa thẻ "Sao Mai: găng tay x3, 270.000đ"
    When tôi mở trang Hôm nay
    Then ghi chú "bán 3 hộp găng tay cho đại lý Sao Mai 270k" ghi "Sao Mai: găng tay x3, 270.000đ"

  @desktop-only
  Scenario: Người lạ nhắn bot thì không gì vào sổ
    Given tôi đã đăng nhập
    And hôm nay chưa có ghi chú nào
    When người lạ nhắn bot "ghi giúp tôi đơn này"
    Then bot không trả lời
    When tôi mở trang Hôm nay
    Then không còn ghi chú "ghi giúp tôi đơn này"

  @desktop-only
  Scenario: Thư tới webhook không có secret thì bị từ chối, không gì vào sổ
    Given tôi đã đăng nhập
    And hôm nay chưa có ghi chú nào
    When ai đó gửi tin "tin giả" của Hoa tới webhook mà không có secret
    Then webhook từ chối
    When tôi mở trang Hôm nay
    Then không còn ghi chú "tin giả"
