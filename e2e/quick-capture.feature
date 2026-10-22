Feature: Ghi nhanh
  Bạn ấy gõ vào ô ở cuối màn hình "Hôm nay". Ghi chú hiện ngay, sửa và xoá được,
  xoá thì có Hoàn tác, và không bao giờ mất chữ bạn ấy đã gõ.

  Background:
    Given tôi đã đăng nhập

  Scenario: Một ngày chưa có gì
    Given hôm nay chưa có ghi chú nào
    Then tôi thấy "Hôm nay chưa có ghi chú nào"
    And trang không có lỗi trợ năng

  Scenario: Ghi một ghi chú
    Given hôm nay chưa có ghi chú nào
    When tôi gõ "Giao 2 thùng giấy in cho cửa hàng Minh Tâm" và gửi
    Then ghi chú "Giao 2 thùng giấy in cho cửa hàng Minh Tâm" hiện trong hôm nay
    And ô nhập trống
    And trang không có lỗi trợ năng

  Scenario: Xuống dòng được giữ nguyên
    Given hôm nay chưa có ghi chú nào
    When tôi gõ và gửi:
      """
      cửa hàng Sao Mai hẹn gọi lại thứ 6
      hỏi giá bìa hồ sơ
      """
    Then ghi chú cuối cùng đúng như đã gõ:
      """
      cửa hàng Sao Mai hẹn gọi lại thứ 6
      hỏi giá bìa hồ sơ
      """

  Scenario: Gửi khi chưa gõ gì thì không có gì xảy ra
    Given hôm nay chưa có ghi chú nào
    When tôi gửi mà không gõ gì
    Then tôi thấy "Hôm nay chưa có ghi chú nào"

  Scenario: Sửa một ghi chú
    Given hôm nay chỉ có ghi chú "giấy in x2"
    When tôi sửa ghi chú "giấy in x2" thành "giấy in x3"
    Then ghi chú "giấy in x3" hiện trong hôm nay
    And không còn ghi chú "giấy in x2"

  Scenario: Sửa thành trống thì bị từ chối ngay tại chỗ
    Given hôm nay chỉ có ghi chú "giữ nguyên"
    When tôi sửa ghi chú "giữ nguyên" thành ""
    Then tôi thấy lỗi "Chưa có nội dung"
    And trang không có lỗi trợ năng

  Scenario: Xoá rồi hoàn tác
    Given hôm nay chỉ có ghi chú "nhớ mang catalogue"
    When tôi xoá ghi chú "nhớ mang catalogue"
    Then tôi thấy thông báo "Đã xoá ghi chú"
    And không còn ghi chú "nhớ mang catalogue"
    And trang không có lỗi trợ năng
    When tôi bấm "Hoàn tác"
    Then ghi chú "nhớ mang catalogue" hiện trong hôm nay

  Scenario: Mất mạng thì chữ được giữ lại
    Given hôm nay chưa có ghi chú nào
    And mất kết nối mạng
    When tôi gõ "Đơn cửa hàng Hoà Bình: 3 hộp bìa hồ sơ" và gửi
    Then tôi thấy lỗi "Chưa gửi được. Kiểm tra mạng rồi thử lại."
    And ô nhập vẫn còn "Đơn cửa hàng Hoà Bình: 3 hộp bìa hồ sơ"

  @desktop-only
  Scenario: Trên máy tính, Enter là gửi
    Given hôm nay chưa có ghi chú nào
    When tôi gõ "nhớ gọi cửa hàng Hoà Bình" rồi nhấn Enter
    Then ghi chú "nhớ gọi cửa hàng Hoà Bình" hiện trong hôm nay

  @phone-only
  Scenario: Trên điện thoại, Enter là xuống dòng
    Given hôm nay chưa có ghi chú nào
    When tôi gõ "dòng một" rồi nhấn Enter
    Then ô nhập xuống dòng sau "dòng một"
