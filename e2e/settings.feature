Feature: Cài đặt
  Mỗi người tự lo tài khoản của mình ngay trong app: tên, tên đăng nhập, Face ID hoặc vân tay, mật khẩu dự phòng và
  các thiết bị đang đăng nhập. Việc liên quan đến bảo mật phải xác nhận lại nếu đã đăng nhập từ lâu.

  Scenario: Mở Cài đặt từ menu
    Given tôi đã đăng nhập
    When tôi mở Cài đặt
    Then tôi thấy "Lan"
    And tôi thấy "Thiết bị này"
    And trang không có lỗi trợ năng

  Scenario: Đổi tên ngay trong hàng
    Given tôi đã đăng nhập
    When tôi mở Cài đặt
    And tôi sửa "Tên" thành "Lan Anh"
    Then tôi thấy thông báo "Đã đổi tên"
    And tôi thấy "Lan Anh"
    When tôi sửa "Tên" thành "Lan"
    Then tôi thấy "Lan"

  Scenario: Nhấn Esc thì thôi sửa, con trỏ về lại nút Sửa
    Given tôi đã đăng nhập
    When tôi mở Cài đặt
    And tôi bắt đầu sửa "Tên" rồi nhấn Esc
    Then tôi thấy "Lan"
    And nút "Sửa tên" đang được chọn

  Scenario: Mở Cài đặt từ tab khác, quay lại đúng tab đó
    Given tôi đã đăng nhập
    When tôi mở Cài đặt từ tab "Đơn hàng"
    And tôi bấm quay lại
    Then tôi thấy tiêu đề "Đơn hàng"

  Scenario: Đăng nhập đã lâu thì đổi tên đăng nhập phải xác nhận lại
    Given tôi đã đăng nhập từ lâu
    When tôi mở Cài đặt
    And tôi sửa "Tên đăng nhập" thành "lan.nguyen"
    Then tôi được hỏi "Xác nhận lại"
    And trang không có lỗi trợ năng
    When tôi xác nhận bằng mật khẩu sai thì được báo sai ngay
    And tôi xác nhận bằng mật khẩu của Lan
    Then tôi thấy thông báo "Đã đổi tên đăng nhập"
    And tôi thấy "lan.nguyen"
    When tôi sửa "Tên đăng nhập" thành "lan"
    Then tôi thấy thông báo "Đã đổi tên đăng nhập"

  # WebKit in Playwright has no passkeys
  @chromium-only
  Scenario: Đăng nhập đã lâu, có Face ID: xác nhận bằng Face ID rồi đặt mật khẩu dự phòng
    Given máy này có Face ID của Hoa
    And Hoa đã đăng nhập từ lâu
    And mật khẩu nào cũng chưa từng bị lộ
    When tôi mở Cài đặt
    And tôi đặt mật khẩu dự phòng "một câu đủ dài để xác nhận lại bằng Face ID"
    Then tôi được hỏi "Xác nhận lại"
    When tôi xác nhận bằng Face ID
    Then mật khẩu dự phòng đã được lưu

  # WebKit in Playwright has no passkeys, and Minh's only way in is the setup link
  @chromium-only
  Scenario: Đặt mật khẩu dự phòng rồi đăng nhập bằng nó
    Given máy này có Face ID
    And mật khẩu nào cũng chưa từng bị lộ
    When tôi mở link cài đặt mới
    And tôi bấm "Bật ngay"
    Then tôi đang ở trang Hôm nay
    When tôi mở Cài đặt
    And tôi đặt mật khẩu dự phòng "một câu đủ dài để thử đăng nhập"
    Then mật khẩu dự phòng đã được lưu
    When tôi đăng xuất từ Cài đặt
    Then tôi đang ở trang đăng nhập
    When tôi đăng nhập bằng "minh" và mật khẩu "một câu đủ dài để thử đăng nhập"
    Then tôi đang ở trang Hôm nay
