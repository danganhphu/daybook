# daybook - thiết kế sản phẩm

Trạng thái: bản nháp đã thống nhất qua thảo luận ngày 2026-10-15. Chưa viết dòng code nào.

Stack chốt được phần lớn: **Aspire** điều phối chạy local, dựng frontend và backend lên cùng lúc dưới một AppHost -
kéo theo backend là .NET. Frontend là **Next.js** với **shadcn/ui**, lint bằng **`@shadcn/lint`**. Còn để ngỏ: con
bot nằm ở đâu, và dùng database nào.

## Người dùng

Một người: bạn gái của chủ repo. Trình dược viên, bán vật tư và thuốc nha khoa cho các phòng khám. Không phải dân
kỹ thuật. Một ngày của bạn ấy có đủ cả gọi điện, đi gặp khách tại phòng khám, và trả lời tin nhắn.

Bạn ấy **chưa biết** về tool này - đây là món làm xong mới tặng. Nghĩa là toàn bộ thiết kế dưới đây đang dựa trên
suy đoán về quy trình làm việc của bạn ấy, chưa được kiểm chứng. Hệ quả: làm nhỏ, và chuẩn bị tinh thần đoán sai ở
vài chỗ. Phần giá trị nhất sẽ đến sau khi ngồi xem bạn ấy dùng thật.

## Vấn đề

Nguyên văn lời chủ repo: "thay vì mỗi lần phải mở note ra note, rồi quên trước quên sau".

Vấn đề là **quên**, không phải thống kê. Chi tiết này định hình mọi thứ, vì dashboard không chữa được bệnh quên -
nó nằm im chờ người ta nhớ ra mà mở. Thứ chữa được quên là bot chủ động nhắn trước.

Báo cáo nộp trưởng phòng thì bạn ấy vẫn tự viết tay. Tool không cần bám mẫu nào của công ty, chỉ cần trình bày số
liệu đủ sạch để liếc vào là chép sang được.

## Đối thủ thật sự

Không phải phần mềm nào cả, mà là **ứng dụng ghi chú trên điện thoại bạn ấy**.

Note thắng ở chỗ: mở ra gõ gì cũng được, không bắt điền đúng ô, không bắt chọn loại trước, không chờ mạng. Nếu
daybook chậm hơn hoặc nhiều bước hơn note, bạn ấy sẽ lặng lẽ quay về note và mình ngồi nhìn cái dashboard rỗng.

Đây là thước đo để cân mọi tính năng về sau.

## Nguyên tắc giao diện

Quy về một câu: **gõ như đang nhắn cho người thật, không phải điền đơn cho máy.**

- **Chữ tự do là đường chính.** Lệnh gạch chéo có, nhưng là đường phụ.
- **Không bao giờ từ chối đầu vào.** Parse không ra thì vẫn lưu nguyên câu thành ghi chú. Làm mất chữ của người
  dùng là lỗi nặng nhất tool này có thể phạm.
- **Lưu trước, sửa sau.** Không bắt xác nhận. Lý do ở mục dưới.
- **Hoàn tác luôn có.** Người ta chỉ dám gõ nhanh khi biết lỡ sai thì sửa được.
- **Không bắt khai báo gì trước khi dùng.** Không có màn hình nhập danh mục sản phẩm. Giá trị phải đến trước công sức.
- **Bot nhắn trước**, không chờ được hỏi.

## Quyết định: không bắt xác nhận từng tin

Phương án đầu là mỗi tin nhắn hiện thẻ kèm nút [Đúng] [Sửa], bạn ấy chạm Đúng thì mới lưu. Đã bác bỏ.

Một ngày mười lăm tin là mười lăm cú chạm không mang lại thông tin gì, và đó đúng là loại ma sát khiến người ta bỏ
tool. Chi phí của một dòng sai được sửa sau thấp hơn nhiều chi phí bắt xác nhận cả ngày.

Thay vào đó: lưu ngay, hiện thẻ kết quả kèm nút Sửa và Xoá nằm sẵn trong khung chat.

Chỉ hỏi lại khi thật sự không chắc - ví dụ tên khách khớp với hai phòng khám.

## Các màn hình hội thoại

### Ghi đơn

```
Bạn ấy:  bán 2 hộp gel tê cho PK chị Lan 500k

Bot:     Đã lưu đơn
         PK Lan Anh - Gel tê x2 - 500.000đ

         Đơn thứ 12 tháng này, tổng 8.450.000đ
         [Sửa]  [Xoá]
```

Dòng tổng cuối có hai tác dụng: xác nhận ngầm rằng số liệu đang chạy đúng, và cho bạn ấy cảm giác tiến triển.

### Khi không chắc

```
Bot:     Gel tê x2 - 500.000đ. Nhưng "chị Lan" là chỗ nào?
         [PK Lan Anh]  [NK Hương Lan]  [Thêm mới]
```

### Nuốt mọi loại nội dung

Một ô nhập duy nhất, bot tự phân loại:

| Bạn ấy gõ | Bot hiểu thành |
|---|---|
| `bán 2 hộp gel tê cho PK chị Lan 500k` | đơn hàng |
| `PK Minh Châu hẹn gọi lại thứ 5` | việc cần nhắc |
| `chị Hà hỏi giá gel tê, chưa trả lời` | việc cần nhắc |
| `PK Sao Việt đang dùng hàng hãng khác` | ghi chú về khách |
| `nhớ mang catalogue` | ghi chú |

Phân loại không nổi:

```
Bot:     Mình chưa hiểu rõ nên lưu tạm thành ghi chú.
         [Ghi thành đơn]  [Đặt nhắc nhở]  [Để vậy]
```

### Bot nhắn trước

```
7:30 sáng
         Chào buổi sáng. Hôm nay có:
           - Gọi lại PK Minh Châu (hẹn hôm nay)
           - PK Lan Anh 3 tuần chưa ghé
         [Xong rồi]  [Để mai]
```

```
Chiều thứ 6
         Tuần này (09-15/10)
           12 đơn, 8.450.000đ
           6 phòng khám
           Nhiều nhất: PK Minh Châu (3 đơn)

         Lâu chưa liên hệ:
           PK Hoa Mai    24 ngày
           PK Sao Việt   31 ngày
```

Khối thứ 6 chính là thứ bạn ấy chép tay sang báo cáo nộp trưởng phòng.

Hai con số còn để ngỏ, chờ hỏi bạn ấy: giờ nhắn buổi sáng, và ngưỡng "lâu chưa liên hệ". Ngưỡng 3 tuần hiện là bịa
ra, chưa biết chu kỳ ghé lại thật của nghề này. Cho chỉnh được trong phần cài đặt, mặc định 3 tuần.

### Tra cứu

Gõ tên khách là ra, không cần nút tìm kiếm:

```
Bạn ấy:  chị Lan

Bot:     PK Lan Anh - 0909xxx
         Gần nhất: 12/10, gel tê x2, 500.000đ
         Tổng từ trước: 14 đơn, 11.200.000đ

         Ghi chú: thích gọi buổi sáng, hay hỏi
         chiết khấu theo lô
         [Lịch sử đầy đủ]  [Ghi đơn mới]
```

## Lệnh gạch chéo

Chữ tự do vẫn là đường chính, nhưng Telegram có nút menu hiện sẵn danh sách lệnh - thứ đó giải được điểm yếu lớn
nhất của giao diện chat: khung chat trống trơn không cho biết gõ gì được. Nên lệnh vừa là đường tắt cho người đã
quen, vừa là bảng chỉ dẫn cho người mới.

| Lệnh | Việc |
|---|---|
| `/homnay` | đơn và việc của hôm nay |
| `/tuan` | tổng kết tuần, đúng khối bot gửi chiều thứ 6 |
| `/thang` | tổng kết tháng |
| `/khach <tên>` | hồ sơ một phòng khám |
| `/nhac` | danh sách việc cần nhắc đang mở |
| `/sua` | sửa mục vừa ghi gần nhất |
| `/web` | link mở PWA |
| `/caidat` | giờ nhắn sáng, ngưỡng lâu chưa liên hệ |
| `/trogiup` | ví dụ các câu gõ được |

Nguyên tắc: **mọi lệnh đều phải làm được bằng chữ thường.** Lệnh là lối tắt, không bao giờ là con đường duy nhất tới
một tính năng.

## Dữ liệu

Mô hình không dính gì tới ngành thuốc - đổi sang bán ngành khác thì không phải sửa gì ngoài danh mục sản phẩm.

| Bảng | Giữ gì |
|---|---|
| `customer` | phòng khám, kèm các tên gọi khác ("chị Lan" -> PK Lan Anh) |
| `product` | tên, giá gần nhất. Sinh ra từ lúc gõ, không khai báo trước |
| `order` + `order_line` | đơn và các dòng hàng |
| `interaction` | lần gọi, lần ghé, tin nhắn |
| `reminder` | nội dung, hạn, đã xong chưa |
| `capture` | **nguyên văn mọi tin nhắn** kèm kết quả parse và độ chắc chắn |

`capture` là bảng quan trọng nhất và dễ bị bỏ sót nhất. Nó giữ nguyên văn mọi thứ bạn ấy gõ, kể cả khi parse sai
hoặc parse hỏng. Hai lợi ích: lần ngược lại được khi số liệu trông lạ, và sau này cải tiến cách parse thì chạy lại
được trên toàn bộ dữ liệu cũ.

## Kiến trúc

Hai cửa vào, một bộ não:

```
  Telegram bot  --+
                  +--> API (parse, luu, nhac, thong ke) --> database
  PWA (web)     --+
```

Điều kiện bắt buộc: **không có logic nào nằm trong bot**. Bot nhận chữ, gọi API, hiện kết quả. Web cũng vậy. Giữ
được kỷ luật này thì thêm cửa vào thứ ba sau này - Zalo, Messenger - chỉ là viết thêm một lớp mỏng.

Chạy local bằng **Aspire**: một AppHost dựng cả frontend lẫn backend lẫn database lên cùng lúc, một lệnh, không
phải mở ba cửa sổ terminal. Backend vì thế là .NET, frontend là Next.js + shadcn/ui.

PWA nói ở trên là chính cái Next.js này - thêm manifest và service worker, không phải một app thứ hai.

Zalo đã cân nhắc và loại cho bản đầu: Official Account API đòi xác minh doanh nghiệp, có phí, giới hạn số tin. Không
hợp một món cá nhân. Bạn ấy có sẵn Telegram nên vấn đề này tạm không tồn tại.

## Web làm gì

Không phải nơi làm việc - nơi xem và sửa:

- một ô chat y hệt bot, cho lúc ngồi máy
- bảng đơn hàng: lọc, sắp xếp, sửa hàng loạt. Đây là thứ chat làm dở
- trang số liệu tuần và tháng
- hồ sơ từng phòng khám

PWA, thêm vào màn hình chính điện thoại, không qua chợ ứng dụng.

## Phạm vi bản đầu

Làm:

1. Telegram nhận mọi loại tin, parse bằng LLM, lưu ngay, thẻ kết quả có Sửa và Xoá
2. Tra cứu bằng cách gõ tên khách
3. Nhắc chủ động: sáng và chiều thứ 6
4. Web: ô chat, bảng đơn sửa được, một trang số liệu
5. Bộ lệnh gạch chéo ở trên

Để sau, có lý do:

| Hoãn | Vì sao |
|---|---|
| Google Drive | kéo theo OAuth, token hết hạn, quyền truy cập. Khi database đã là nguồn sự thật thì Drive chỉ là bản sao |
| Xuất Excel / docx | báo cáo chính thức bạn ấy viết tay. Chỉ cần số liệu dễ đọc, chưa cần file |
| Nhiều người dùng | đúng một người dùng. Đừng xây phân quyền cho một người |
| App mobile riêng | PWA đủ, và không phải qua kiểm duyệt chợ ứng dụng |

## Những chỗ còn chưa biết

- Chu kỳ ghé lại một phòng khám của nghề trình dược là bao lâu
- Trưởng phòng chấm bạn ấy bằng gì ngoài doanh số. Nếu có đếm số lượt ghé thì `interaction` phải lên ngang hàng với
  `order` về mức độ quan trọng, chứ không phải ghi chú phụ
- Bạn ấy đang ghi chính xác những gì vào ứng dụng note. Đây là câu đáng giá nhất, và chỉ trả lời được sau khi tặng
