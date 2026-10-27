Feature: Chuyển màn
  Bấm sang màn khác thì màn đang xem giữ nguyên tới khi màn mới sẵn sàng, không có màn chờ nháy lên. Chỉ khi chờ
  quá một giây mới có một thanh mảnh chạy dọc mép trên.

  Background:
    Given tôi đã đăng nhập

  Scenario: Màn tới chậm thì có thanh chạy ở mép trên, tới rồi thì tắt
    Given màn "/customers" đang tới chậm
    When tôi mở trang Hôm nay
    And trang Hôm nay đã sẵn sàng
    And tôi bấm tab "Khách hàng"
    Then có thanh chờ chạy ở mép trên
    And tôi thấy tiêu đề "Khách hàng"
    And thanh chờ đã tắt
