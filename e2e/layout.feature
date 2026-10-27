Feature: Màn hẹp, chữ to
  Điện thoại để chữ to, hay màn chỉ rộng 320px, thì trang vẫn chỉ cuộn dọc: không có gì đẩy trang rộng hơn màn hình
  (WCAG 1.4.10 và 1.4.4).

  # WebKit: /reminders is 7px too wide at 200%, and a stylesheet is refused by the CSP (known-gaps)
  @iphone-later
  Scenario: Các màn chính không phải kéo ngang
    Given tôi đã đăng nhập
    Then các màn "/, /orders, /customers, /reports, /history?q=kim, /reminders, /products, /orders/new, /customers/new, /settings" không phải kéo ngang khi màn hẹp và chữ to
