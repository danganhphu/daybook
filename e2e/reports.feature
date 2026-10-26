Feature: Báo cáo
  Doanh số, tiền thu về và khách còn nợ của một kỳ; doanh số theo thời gian, theo loại khách, theo sản phẩm, theo
  khách. Chạm một sản phẩm hay một khách thì cả báo cáo lọc theo đó. Các kịch bản xem ngày hôm qua, ngày chỉ có đơn có sẵn của
  Hướng Dương, nên đơn các kịch bản khác tạo hôm nay không làm đổi số.

  Background:
    Given tôi đã đăng nhập

  Scenario: Xem báo cáo một ngày có đơn
    When tôi xem báo cáo ngày hôm qua
    Then báo cáo có "Doanh số" là "800.000đ"
    And báo cáo có "Thu về" là "0đ"
    And báo cáo có "Khách còn nợ" là "800.000đ"
    And sản phẩm bán chạy có "Kim nha khoa" với "800.000đ"
    And trang không có lỗi trợ năng

  Scenario: Chạm một sản phẩm để lọc, rồi bỏ lọc
    When tôi xem báo cáo ngày hôm qua
    And tôi chạm "Kim nha khoa" trong sản phẩm bán chạy
    Then báo cáo đang lọc theo "Kim nha khoa"
    And báo cáo có "Số lượng" là "2"
    When tôi bỏ lọc "Kim nha khoa"
    Then báo cáo không lọc theo gì
    And báo cáo có "Khách còn nợ" là "800.000đ"

  Scenario: Chạm vào biểu đồ để xem số của một ngày
    When tôi xem báo cáo từ hôm qua tới hôm nay
    And tôi chạm vào nửa trái biểu đồ
    Then biểu đồ đọc "800.000đ, 1 đơn" cho ngày hôm qua
    When tôi bấm phím Home trên biểu đồ
    Then thanh trượt của biểu đồ đọc "800.000đ, 1 đơn"

  Scenario: Đổi kỳ báo cáo
    When tôi mở trang Báo cáo
    Then kỳ đang xem là tháng này
    When tôi chọn kỳ "Năm"
    Then kỳ đang xem là năm nay
    When tôi lùi một kỳ
    Then kỳ đang xem là năm ngoái
    And trang không có lỗi trợ năng
