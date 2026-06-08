# ACTVN AI Mobile

Ứng dụng Expo/React Native tối giản cho người dùng role `user`.

## Chức năng

- Đăng nhập bằng tài khoản backend hiện có.
- Đăng ký tài khoản user thường.
- Chặn tài khoản `admin` đăng nhập vào app mobile.
- Tạo hội thoại mới và chat với cùng backend đang dùng cho web.

## Cấu hình server

Điện thoại iPhone không gọi được `localhost` của máy tính. Hãy dùng IP LAN của máy đang chạy backend.

Tạo file `.env` trong thư mục `mobile`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:8000
```

Ví dụ nếu máy tính là `192.168.0.102`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.102:8000
```

Backend FastAPI cần chạy và phải cho phép thiết bị trong cùng Wi-Fi truy cập cổng `8000`.

## Chạy trên iPhone bằng Expo Go

1. Cài Expo Go trên iPhone từ App Store.
2. Đảm bảo iPhone và máy tính cùng một mạng Wi-Fi.
3. Chạy backend:

```bash
cd ../api
uvicorn src.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

4. Chạy app mobile:

```bash
cd ../mobile
npm install
npm start
```

5. Quét QR code bằng camera iPhone hoặc app Expo Go.

Nếu không kết nối được:

- Kiểm tra `EXPO_PUBLIC_API_BASE_URL` đang là IP LAN của máy tính, không phải `localhost`.
- Mở firewall cho cổng `8000`.
- Thử truy cập `http://YOUR_COMPUTER_LAN_IP:8000/health` từ Safari trên iPhone.
- Trong terminal Expo, nhấn `s` để chuyển Expo sang chế độ LAN nếu đang ở tunnel/dev-client mode.
