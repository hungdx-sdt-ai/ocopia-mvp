"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { translations } from "@/lib/translations";

interface Product {
  id: number;
  name: string;
  story: string;
  price: number;
  image_url: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  selected: boolean;
}

export default function Home({ initialView = "home" }: { initialView?: "home" | "products" | "cart" } = {}) {
  const [currentView, setCurrentView] = useState<"home" | "products" | "cart">(initialView);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lang, setLang] = useState<"vi" | "en">("vi");
  const [isDark, setIsDark] = useState<boolean>(true);

  const navigateTo = (view: "home" | "products" | "cart") => {
    setCurrentView(view);
    setActiveDetailProduct(null);
    window.scrollTo(0, 0);
    if (typeof window !== "undefined") {
      const targetUrl = view === "products" ? "/products" : view === "cart" ? "/cart" : "/";
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ view }, "", targetUrl);
      }
    }
  };

  // Load language and theme preference from localStorage on mount + route sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/products") {
        setCurrentView("products");
      } else if (window.location.pathname === "/cart") {
        setCurrentView("cart");
      }
      const handlePopState = () => {
        if (window.location.pathname === "/products") {
          setCurrentView("products");
        } else if (window.location.pathname === "/cart") {
          setCurrentView("cart");
        } else {
          setCurrentView("home");
        }
      };
      window.addEventListener("popstate", handlePopState);

      const savedLang = localStorage.getItem("lang") as "vi" | "en";
      if (savedLang) setLang(savedLang);

      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "light") {
        setIsDark(false);
        document.documentElement.classList.add("light");
      } else {
        setIsDark(true);
        document.documentElement.classList.remove("light");
      }

      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, []);

  const toggleLang = () => {
    const nextLang = lang === "vi" ? "en" : "vi";
    setLang(nextLang);
    localStorage.setItem("lang", nextLang);
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    }
  };

  const t = translations[lang] as any;


  // Detail Sub-page State
  const [activeDetailProduct, setActiveDetailProduct] = useState<Product | null>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);
  const [selectedDetailImage, setSelectedDetailImage] = useState<string | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);

  const handleOpenDetail = (product: Product) => {
    setSavedScrollPosition(window.scrollY);
    setActiveDetailProduct(product);
    setSelectedDetailImage(null);
    setDetailQuantity(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseDetail = () => {
    setActiveDetailProduct(null);
    setTimeout(() => {
      window.scrollTo(0, savedScrollPosition);
    }, 50);
  };

  // Checkout State
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"banking" | "cod">("cod");
  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string>("");

  // Cart State & Persistent Storage
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartToast, setCartToast] = useState<string | null>(null);
  const [checkoutItems, setCheckoutItems] = useState<{ product: Product; quantity: number }[]>([]);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("ocopia_cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {
      console.error("Failed to load cart from localStorage", e);
    }
  }, []);

  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem("ocopia_cart", JSON.stringify(newCart));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  };

  const handleAddToCart = (product: Product, qty: number = 1) => {
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    let newCart: CartItem[];
    if (existingIndex > -1) {
      newCart = cart.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + qty } : item
      );
    } else {
      newCart = [...cart, { product, quantity: qty, selected: true }];
    }
    updateCart(newCart);
    setCartToast(t.addedToCartToast || (lang === "vi" ? "Đã thêm vào giỏ hàng thành công!" : "Added to cart successfully!"));
    setTimeout(() => {
      setCartToast(null);
    }, 2800);
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const selectedCartItems = cart.filter((item) => item.selected);
  const selectedTotalAmount = selectedCartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const selectedTotalCount = selectedCartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const isAllSelected = cart.length > 0 && cart.every((item) => item.selected);

  const toggleSelectAll = () => {
    const nextState = !isAllSelected;
    updateCart(cart.map((item) => ({ ...item, selected: nextState })));
  };

  const toggleSelectItem = (productId: number) => {
    updateCart(
      cart.map((item) =>
        item.product.id === productId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const updateItemQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      updateCart(cart.filter((item) => item.product.id !== productId));
    } else {
      updateCart(
        cart.map((item) =>
          item.product.id === productId ? { ...item, quantity: newQty } : item
        )
      );
    }
  };

  const removeItem = (productId: number) => {
    updateCart(cart.filter((item) => item.product.id !== productId));
  };

  const removeSelectedItems = () => {
    updateCart(cart.filter((item) => !item.selected));
  };

  // Banking QR + Countdown State
  const [bankingQR, setBankingQR] = useState<{
    qrCode: string;
    orderId: number;
    checkoutUrl: string;
  } | null>(null);
  const [qrCountdown, setQrCountdown] = useState(300);

  // PayOS Redirect Status State
  const [paymentRedirectStatus, setPaymentRedirectStatus] = useState<{
    status: "success" | "cancelled";
    orderId: string;
  } | null>(null);

  // Navbar & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Handle PayOS redirect parameters on mount + back button detection via pageshow
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Hàm xử lý hủy đơn khi user quay lại mà không hoàn tất thanh toán
    const cancelPendingOrder = () => {
      const pendingOrderStr = sessionStorage.getItem("pendingPayOSOrder");
      if (!pendingOrderStr) return;
      try {
        const pendingOrder = JSON.parse(pendingOrderStr);
        sessionStorage.removeItem("pendingPayOSOrder");
        supabase
          .from("orders")
          .update({ status: "Cancelled" })
          .eq("id", pendingOrder.orderId)
          .then(({ error }) => {
            if (error) {
              console.error("Lỗi khi hủy đơn do user quay lại:", error);
            } else {
              console.log(`Đơn hàng #${pendingOrder.orderId} đã bị hủy do user quay lại trang.`);
            }
          });
        setPaymentRedirectStatus({
          status: "cancelled",
          orderId: String(pendingOrder.orderId)
        });
      } catch {
        sessionStorage.removeItem("pendingPayOSOrder");
      }
    };

    // Xử lý URL params từ PayOS redirect (success / cancelled)
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status");
    // PayOS có thể trả về 'orderId' (custom) hoặc 'orderCode' (của PayOS)
    const orderIdParam = params.get("orderId") || params.get("orderCode");
    
    if (statusParam && orderIdParam) {
      // Có URL params → đến từ redirect của PayOS → xóa pending order trong sessionStorage
      sessionStorage.removeItem("pendingPayOSOrder");
      const normalizedStatus = statusParam.toLowerCase();

      if (normalizedStatus === "success") {
        setPaymentRedirectStatus({ status: "success", orderId: orderIdParam });
      } else if (normalizedStatus === "cancelled" || normalizedStatus === "cancel") {
        supabase
          .from("orders")
          .update({ status: "Cancelled" })
          .eq("id", orderIdParam)
          .then(({ error }) => {
            if (error) {
              console.error("Lỗi khi cập nhật trạng thái hủy đơn:", error);
            } else {
              console.log(`Đơn hàng #${orderIdParam} đã được cập nhật thành Cancelled.`);
            }
          });
        setPaymentRedirectStatus({ status: "cancelled", orderId: orderIdParam });
      }
      
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Lắng nghe sự kiện 'pageshow' để phát hiện bfcache restore (bấm nút Back trình duyệt)
    // useEffect không chạy lại khi bfcache restore, nhưng 'pageshow' luôn kích hoạt
    const handlePageShow = (e: PageTransitionEvent) => {
      // e.persisted = true nghĩa là trang được khôi phục từ bfcache (bấm Back)
      if (e.persisted) {
        cancelPendingOrder();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Countdown timer for banking QR payment (5 minutes)
  useEffect(() => {
    if (!bankingQR) return;
    setQrCountdown(300);
    const capturedOrderId = bankingQR.orderId;
    const timer = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Hết giờ → tự động hủy đơn
          supabase
            .from("orders")
            .update({ status: "Cancelled" })
            .eq("id", capturedOrderId)
            .then(({ error }) => {
              if (!error) console.log(`Đơn hàng #${capturedOrderId} hết hạn QR đã bị hủy.`);
            });
          setBankingQR(null);
          setIsCheckoutOpen(false);
          setPaymentRedirectStatus({ status: "cancelled", orderId: String(capturedOrderId) });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankingQR?.orderId]);

  // Product detailed metadata for all 8 products
  const PRODUCT_METADATA: Record<number, {
    packaging: string;
    rating: string;
    badge: string;
    tagline: { vi: string; en: string };
    lifestyleImage: string;
    gallery: string[];
    highlights: { vi: string[]; en: string[] };
    specs: { vi: { label: string; value: string }[]; en: { label: string; value: string }[] };
    story: { vi: string[]; en: string[] };
  }> = {
    1: {
      packaging: "Hộp 180g",
      rating: "OCOP 4★",
      badge: "Đặc sản Quảng Nam",
      tagline: {
        vi: "Bánh giòn rụm thanh ngọt, hòa quyện vị bùi béo dừa tươi, gạo lứt và đậu xanh xứ Quảng",
        en: "Crispy and fragrant baked coconut cake with brown rice and mung beans from Quang Nam",
      },
      lifestyleImage: "/products/p1_main.png",
      gallery: [
        "/products/p1_front.png",
        "/products/p1_back.png",
        "/products/cert_ocop.jpg",
        "/products/cert_atvstp.png",
      ],
      highlights: {
        vi: [
          "Chắt chiu từ 60% cơm dừa tươi nguyên chất kết hợp bột nếp dẻo thơm, gạo lứt bổ dưỡng và đậu xanh bùi bùi.",
          "Nướng giòn rụm đặc trưng, vị ngọt thanh tự nhiên từ đường mía, bơ và thoảng hương vani quyến rũ.",
          "Chứng nhận OCOP tỉnh Quảng Nam và chứng nhận An toàn vệ sinh thực phẩm (ATVSTP).",
          "Bao bì hộp sang trọng, thanh nhã, món quà quê giản dị đượm tình trao gửi người thân, bạn bè.",
        ],
        en: [
          "Crafted with 60% pure fresh coconut, fragrant glutinous rice, wholesome brown rice, and rich mung beans.",
          "Distinctive crispy texture with gentle natural sweetness from cane sugar, butter, and fragrant vanilla aroma.",
          "Certified OCOP specialty of Quang Nam province and certified food safety and hygiene.",
          "Elegant box packaging, an authentic gift expressing warmth and heritage after every journey.",
        ],
      },
      specs: {
        vi: [
          { label: "Tên sản phẩm", value: "Bánh dừa gạo lứt đậu xanh Bảo Linh 180g" },
          { label: "Thương hiệu", value: "Bảo Linh (Ocopia Heritage phân phối)" },
          { label: "Quy cách đóng gói", value: "Hộp 180g" },
          { label: "Hạn sử dụng", value: "12 tháng kể từ ngày sản xuất" },
          { label: "Thành phần", value: "Dừa (60%), đường, bột nếp, bột gạo lứt (6%), đậu xanh (6%), bơ, vani" },
          { label: "Hướng dẫn sử dụng", value: "Ăn ngay khi mở bao. Ngon nhất khi thưởng thức cùng tách trà ấm" },
          { label: "Hướng dẫn bảo quản", value: "Để nơi khô ráo và thoáng mát, tránh ánh nắng trực tiếp" },
          { label: "Thông tin cảnh báo", value: "Không dùng khi sản phẩm bị mốc hoặc sản phẩm hết hạn sử dụng" },
          { label: "Số công bố", value: "02/HIEUBANHBAOLINH/2023" },
          { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP tỉnh Quảng Nam, Chứng nhận ATVSTP" },
        ],
        en: [
          { label: "Product Name", value: "Bao Linh Coconut Cake with Brown Rice & Mung Bean 180g" },
          { label: "Brand", value: "Bao Linh (Distributed by Ocopia Heritage)" },
          { label: "Packaging", value: "180g Box" },
          { label: "Shelf Life", value: "12 months from manufacture date" },
          { label: "Ingredients", value: "Coconut (60%), sugar, glutinous rice flour, brown rice flour (6%), mung bean (6%), butter, vanilla" },
          { label: "Usage Instructions", value: "Ready to eat directly upon opening. Best paired with warm tea" },
          { label: "Storage", value: "Store in a cool, dry place away from direct sunlight" },
          { label: "Standard", value: "Quang Nam OCOP Certified, Food Hygiene Safety Certificate" },
        ],
      },
      story: {
        vi: [
          "Kế thừa trọn vẹn tinh túy của làng nghề đặc sản xứ Quảng, Bánh Dừa Nướng Gạo Lứt Đậu Xanh Bảo Linh là sự giao thoa hoàn hảo giữa công thức truyền thống lâu đời và những sản vật mộc mạc từ thiên nhiên.",
          "Từng chiếc bánh được chắt chiu từ cơm dừa tươi nguyên chất béo ngậy, bột nếp dẻo thơm, kết hợp cùng gạo lứt bổ dưỡng, vị bùi thanh của đậu xanh và những hạt mè vàng thơm lừng. Qua ngọn lửa nướng vừa độ, bánh đạt tới độ giòn rụm đặc trưng. Cắn một miếng, vị ngọt bùi của dừa và đậu xanh hòa cùng hương thơm thanh nhã của gạo lứt và mè rang ngay lập tức lan tỏa, gợi thức trọn vẹn hương vị mặn mòi, ấm áp của đất và người miền Trung.",
          "Không chỉ là thức quà ăn vặt giòn tan, vui miệng bên tách trà chiều, Bánh Dừa Nướng Gạo Lứt Đậu Xanh Bảo Linh còn là gói trọn sự tử tế, chân thành của người thợ xứ Quảng – món quà quê giản dị nhưng đượm tình để gửi trao người thân, bạn bè sau mỗi chuyến đi xa.",
        ],
        en: [
          "Inheriting the essence of Quang Nam's traditional craft village, Bao Linh Baked Coconut Cake with Brown Rice & Mung Bean is a harmonious fusion of time-honored recipes and rustic natural ingredients.",
          "Each piece is carefully crafted from rich fresh coconut meat, fragrant glutinous rice, wholesome brown rice, delicate nutty mung beans, and golden toasted sesame seeds. Baked to perfection over gentle heat, it attains an iconic crispy crunch. With each bite, the nutty sweetness of coconut and mung beans mingles with the fragrant elegance of roasted sesame and brown rice.",
          "More than just a delightful tea snack, it carries the heartfelt warmth and sincerity of Quang Nam artisans – a thoughtful heritage gift to share with loved ones after every journey.",
        ],
      },
    },
    2: {
      packaging: "Hộp 180g",
      rating: "OCOP 4★",
      badge: "Đặc sản Quảng Nam",
      tagline: {
        vi: "Hương mè rang thơm lừng quyện cùng dừa tươi béo ngậy và gạo lứt giòn tan khó cưỡng",
        en: "Fragrant wood-roasted sesame blended with creamy fresh coconut and crispy brown rice",
      },
      lifestyleImage: "/products/p2_main.png",
      gallery: [
        "/products/p2_front.png",
        "/products/p2_back.png",
        "/products/cert_ocop.jpg",
        "/products/cert_atvstp.png",
      ],
      highlights: {
        vi: [
          "Sự kết hợp hoàn hảo giữa 60% dừa tươi nướng giòn và mè vàng rang củi thơm lừng, bổ dưỡng.",
          "Hạt gạo lứt lành tính tăng cường chất xơ, bùi bùi giòn rụm, ngọt dịu thanh nhẹ đầu lưỡi.",
          "Đạt chuẩn OCOP Quảng Nam và giấy chứng nhận An toàn vệ sinh thực phẩm.",
          "Đóng hộp chỉn chu, thích hợp thưởng thức cùng trà nóng hoặc làm quà biếu du lịch ý nghĩa.",
        ],
        en: [
          "Perfect harmony of 60% toasted fresh coconut and fragrant firewood-roasted golden sesame seeds.",
          "Wholesome brown rice providing natural dietary fiber, crispy bite, and delicate sweetness.",
          "Certified Quang Nam OCOP specialty and food safety standards.",
          "Sophisticated box packaging, perfect for pairing with hot tea or as a cultural souvenir.",
        ],
      },
      specs: {
        vi: [
          { label: "Tên sản phẩm", value: "Bánh dừa gạo lứt mè Bảo Linh 180g" },
          { label: "Thương hiệu", value: "Bảo Linh (Ocopia Heritage phân phối)" },
          { label: "Quy cách đóng gói", value: "Hộp 180g" },
          { label: "Hạn sử dụng", value: "12 tháng kể từ ngày sản xuất" },
          { label: "Thành phần", value: "Dừa (60%), đường, bột nếp, bột gạo lứt (6%), mè (6%), bơ, vani" },
          { label: "Hướng dẫn sử dụng", value: "Ăn ngay khi mở bao. Dùng kèm trà xanh hoặc cà phê" },
          { label: "Hướng dẫn bảo quản", value: "Để nơi khô ráo và thoáng mát, tránh ánh nắng trực tiếp" },
          { label: "Thông tin cảnh báo", value: "Không dùng khi sản phẩm bị mốc hoặc sản phẩm hết hạn sử dụng" },
          { label: "Số công bố", value: "01/HIEUBANHBAOLINH/2023" },
          { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP tỉnh Quảng Nam, Chứng nhận ATVSTP" },
        ],
        en: [
          { label: "Product Name", value: "Bao Linh Coconut Cake with Brown Rice & Sesame 180g" },
          { label: "Brand", value: "Bao Linh (Distributed by Ocopia Heritage)" },
          { label: "Packaging", value: "180g Box" },
          { label: "Shelf Life", value: "12 months from manufacture date" },
          { label: "Ingredients", value: "Coconut (60%), sugar, glutinous rice flour, brown rice flour (6%), sesame (6%), butter, vanilla" },
          { label: "Usage Instructions", value: "Ready to eat directly upon opening. Excellent with green tea or coffee" },
          { label: "Standard", value: "Quang Nam OCOP Certified, Food Hygiene Safety Certificate" },
        ],
      },
      story: {
        vi: [
          "Từ mảnh đất Quảng Nam dạt dào nắng gió, Bánh Dừa Nướng Gạo Lứt Mè Bảo Linh kế thừa trọn vẹn nét đẹp của công thức truyền thống lâu đời, biến những sản vật mộc mạc quê nhà thành thức quà tinh tế, giòn tan.",
          "Sự kết hợp hoàn hảo giữa cơm dừa tươi nguyên chất béo bùi, bột nếp dẻo thơm cùng hạt gạo lứt bổ dưỡng và những hạt mè vàng ươm đã tạo nên nét chấm phá đầy khác biệt. Qua bàn tay chăm chút của người thợ và ngọn lửa nướng vừa độ, từng chiếc bánh ra đời mang hương thơm lừng quyến rũ. Cắn nhẹ một miếng, tiếng giòn rụm vang lên vui tai, lập tức lan tỏa vị ngọt thanh tự nhiên của dừa tươi, vị béo bùi đậm đà của mè rang hòa cùng hương vị mộc mạc, lành tính của gạo lứt.",
          "Không chỉ dừng lại ở một món ăn vặt tròn vị bên tách trà nóng, Bánh Dừa Nướng Gạo Lứt Mè Bảo Linh còn gói trọn cả nét văn hóa ẩm thực xứ Quảng – chân thành, mộc mạc nhưng đượm tình, là món quà du lịch trọn vẹn ý nghĩa dành tặng người thân và bạn bè.",
        ],
        en: [
          "From the sun-drenched, breezy land of Quang Nam, Bao Linh Coconut Cake with Brown Rice & Sesame preserves the charm of time-honored recipes, turning rustic hometown ingredients into an exquisite, crispy delicacy.",
          "The perfect blend of rich fresh coconut, fragrant sticky rice, wholesome brown rice, and golden sesame seeds creates a unique culinary character. Meticulously baked to perfection, each cake offers a delightful crunch, releasing the gentle sweetness of coconut and the rich savory aroma of roasted sesame.",
          "A complete treat alongside a warm cup of tea, it encapsulates Central Vietnam's culinary soul – sincere, rustic, and profoundly heartwarming, serving as a meaningful gift for friends and family.",
        ],
      },
    },
    3: {
      packaging: "Hộp 250g",
      rating: "OCOP 4★",
      badge: "Bán chạy nhất",
      tagline: {
        vi: "Đặc sản xứ Quảng nức tiếng - 100% nguyên liệu tự nhiên, giòn rụm béo bùi chuẩn vị truyền thống",
        en: "Famous Quang Nam specialty - 100% natural ingredients, authentic crispy coconut crunch",
      },
      lifestyleImage: "/products/p3_main.png",
      gallery: [
        "/products/p3_detail.png",
        "/products/cert_ocop.jpg",
        "/products/cert_atvstp.png",
      ],
      highlights: {
        vi: [
          "100% nguyên liệu tự nhiên: Bột nếp hảo hạng, dừa tươi, đường trắng, vani tự nhiên.",
          "Tuyệt đối không hóa chất bảo quản hay phẩm màu phụ gia, an toàn sức khỏe tuyệt đối.",
          "Đã được chứng nhận OCOP tỉnh Quảng Nam và chứng nhận an toàn thực phẩm ATVSTP.",
          "Quy cách đóng hộp 250g trang nhã, sang trọng, thích hợp làm quà tặng đặc sản và thưởng trà.",
        ],
        en: [
          "100% all-natural ingredients: Premium sticky rice, fresh coconut meat, cane sugar, natural vanilla.",
          "Zero artificial preservatives or colorants, ensuring total wholesome goodness.",
          "Certified OCOP specialty of Quang Nam and full food hygiene certification.",
          "Elegant 250g box presentation, ideal for gifting and tea-time enjoyment.",
        ],
      },
      specs: {
        vi: [
          { label: "Tên sản phẩm", value: "Bánh dừa nướng Bảo Linh hộp 250g" },
          { label: "Thương hiệu", value: "Bảo Linh (Ocopia Heritage phân phối)" },
          { label: "Quy cách đóng gói", value: "Hộp 250g" },
          { label: "Hạn sử dụng", value: "18 tháng kể từ ngày sản xuất" },
          { label: "Thành phần", value: "Bột nếp, dừa tươi, đường trắng, vani tự nhiên" },
          { label: "Hướng dẫn sử dụng", value: "Dùng làm quà biếu, ăn vặt, nhâm nhi cùng trà ấm" },
          { label: "Hướng dẫn bảo quản", value: "Bảo quản nơi khô ráo, thoáng mát" },
          { label: "Nơi sản xuất", value: "Tam Kỳ, Quảng Nam" },
          { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP tỉnh Quảng Nam, Chứng nhận ATVSTP" },
        ],
        en: [
          { label: "Product Name", value: "Bao Linh Baked Coconut Cake Box 250g" },
          { label: "Brand", value: "Bao Linh (Distributed by Ocopia Heritage)" },
          { label: "Packaging", value: "250g Box" },
          { label: "Shelf Life", value: "18 months from manufacture date" },
          { label: "Ingredients", value: "Glutinous rice flour, fresh coconut, cane sugar, vanilla" },
          { label: "Usage Instructions", value: "Enjoy directly as a delicious tea snack or gift" },
          { label: "Standard", value: "Quang Nam OCOP Certified, Food Hygiene Safety Certificate" },
        ],
      },
      story: {
        vi: [
          "Từ những rặng dừa xanh mướt ngập tràn ánh nắng nhiệt đới, câu chuyện của Bánh dừa Bảo Linh bắt đầu khi nét dân dã ấy dừng chân tại xứ Quảng. Bằng sự tỉ mỉ và tình yêu sản vật quê nhà, Bảo Linh đã biến những cùi dừa tươi quen thuộc thành món bánh nướng giòn tan, chinh phục trọn vẹn cả những thực khách khó tính nhất.",
          "Mỗi chiếc bánh là sự kết tinh hoàn toàn từ thiên nhiên: cơm dừa tươi béo ngậy, bột nếp thơm lừng, chút đường ngọt đậm và hương vani thoang thoảng. Không hóa chất, không phụ gia, quy trình chế biến an toàn tuyệt đối giúp giữ trọn nét thuần khiết của nguyên liệu. Thưởng thức một miếng bánh giòn rụm, vị béo bùi lan tỏa ngay đầu lưỡi như mang cả hương vị trù phú của đất trời nhiệt đới đọng lại nơi vị giác.",
          "Khoác lên mình chiếc áo màu xanh mát – biểu tượng mộc mạc của những tà lá dừa quê hương, Bánh dừa gói Bảo Linh mang vẻ đẹp giản dị, gần gũi. Gọn nhẹ, dễ bảo quản và đượm tình, đây không chỉ là món ăn vặt vui tai vui miệng mà còn là món quà du lịch tinh tế, gửi trao trọn vẹn sự chân thành và ký ức ngọt ngào sau mỗi chuyến đi xa.",
        ],
        en: [
          "From the lush green coconut groves basking in tropical sunshine, the story of Bao Linh Coconut Cake began its journey in Quang Nam. With dedication and deep passion for native ingredients, Bao Linh transformed everyday fresh coconut into golden crispy baked cakes that delight the most discerning palates.",
          "Every single cake is a pure crystallization of nature: rich fresh coconut meat, aromatic sticky rice, subtle cane sugar, and gentle vanilla. Crafted without preservatives or additives, each bite delivers a crunchy sensation and luscious coconut aroma echoing tropical richness.",
          "Presented in an elegant green attire, Bao Linh Coconut Cake is not only an everyday wholesome snack, but also a meaningful gift carrying genuine affection after every journey.",
        ],
      },
    },
    4: {
      packaging: "Gói 150g",
      rating: "OCOP 3★",
      badge: "12 gói tiện lợi",
      tagline: {
        vi: "Quy cách 12 gói nhỏ tiện lợi, giòn tan đậm đà vị ngọt bùi của dừa tươi miền nhiệt đới",
        en: "Convenient 12-pack bag, crunchy and rich with tropical sweet coconut flavors",
      },
      lifestyleImage: "/products/p4_main.png",
      gallery: [
        "/products/p4_detail.png",
        "/products/cert_ocop.jpg",
        "/products/cert_atvstp.png",
      ],
      highlights: {
        vi: [
          "Quy cách túi gồm 12 gói nhỏ bên trong, cực kỳ tiện lợi khi bảo quản, đem theo đi học, đi làm.",
          "Thành phần thuần khiết từ cùi dừa tươi chọn lọc, bột nếp và hương vani thoang thoảng.",
          "Đạt chứng nhận OCOP tỉnh Quảng Nam và chứng nhận an toàn thực phẩm.",
          "Hạn sử dụng dài 18 tháng, món ăn vặt giòn tan mỗi ngày cho gia đình và văn phòng.",
        ],
        en: [
          "Handy bag containing 12 individual snack packs, convenient for work, school, and travel.",
          "Pure recipe from selected coconut meat, glutinous rice flour, and subtle vanilla.",
          "Certified Quang Nam OCOP specialty and food safety accredited.",
          "Long 18-month shelf life, an everyday wholesome crunchy snack.",
        ],
      },
      specs: {
        vi: [
          { label: "Tên sản phẩm", value: "Bánh dừa nướng Bảo Linh gói 150g" },
          { label: "Thương hiệu", value: "Bảo Linh (Ocopia Heritage phân phối)" },
          { label: "Quy cách đóng gói", value: "Gói 150g (12 gói nhỏ/gói)" },
          { label: "Hạn sử dụng", value: "18 tháng kể từ ngày sản xuất" },
          { label: "Thành phần", value: "Dừa tươi, bột nếp, đường trắng, vani" },
          { label: "Hướng dẫn sử dụng", value: "Mở gói dùng trực tiếp, thích hợp cho giờ giải lao" },
          { label: "Hướng dẫn bảo quản", value: "Nơi khô ráo, thoáng mát" },
          { label: "Nơi sản xuất", value: "Tam Kỳ, Quảng Nam" },
          { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP tỉnh Quảng Nam, Chứng nhận ATVSTP" },
        ],
        en: [
          { label: "Product Name", value: "Bao Linh Baked Coconut Cake Bag 150g (12 packs)" },
          { label: "Brand", value: "Bao Linh (Distributed by Ocopia Heritage)" },
          { label: "Packaging", value: "150g Bag (12 individual sachets)" },
          { label: "Shelf Life", value: "18 months from manufacture date" },
          { label: "Ingredients", value: "Fresh coconut, sticky rice flour, cane sugar, vanilla" },
          { label: "Usage Instructions", value: "Open and enjoy directly anytime, anywhere" },
          { label: "Standard", value: "Quang Nam OCOP Certified, Food Hygiene Safety Certificate" },
        ],
      },
      story: {
        vi: [
          "Từ những rặng dừa xanh mướt ngập tràn ánh nắng nhiệt đới, câu chuyện của Bánh dừa Bảo Linh bắt đầu khi nét dân dã ấy dừng chân tại xứ Quảng. Bằng sự tỉ mỉ và tình yêu sản vật quê nhà, Bảo Linh đã biến những cùi dừa tươi quen thuộc thành món bánh nướng giòn tan, chinh phục trọn vẹn cả những thực khách khó tính nhất.",
          "Mỗi chiếc bánh là sự kết tinh hoàn toàn từ thiên nhiên: cơm dừa tươi béo ngậy, bột nếp thơm lừng, chút đường ngọt đậm và hương vani thoang thoảng. Không hóa chất, không phụ gia, quy trình chế biến an toàn tuyệt đối giúp giữ trọn nét thuần khiết của nguyên liệu. Thưởng thức một miếng bánh giòn rụm, vị béo bùi lan tỏa ngay đầu lưỡi như mang cả hương vị trù phú của đất trời nhiệt đới đọng lại nơi vị giác.",
          "Khoác lên mình chiếc áo màu xanh mát – biểu tượng mộc mạc của những tà lá dừa quê hương, Bánh dừa gói Bảo Linh mang vẻ đẹp giản dị, gần gũi. Gọn nhẹ, dễ bảo quản và đượm tình, đây không chỉ là món ăn vặt vui tai vui miệng mà còn là món quà du lịch tinh tế, gửi trao trọn vẹn sự chân thành và ký ức ngọt ngào sau mỗi chuyến đi xa.",
        ],
        en: [
          "From lush tropical coconut palm groves to the heritage kitchens of Quang Nam, Bao Linh Baked Coconut Cake is lovingly crafted into crispy, aromatic delicacies.",
          "With 100% natural ingredients including fresh coconut meat, glutinous rice flour, cane sugar, and fragrant vanilla, every bite is free of artificial additives or preservatives.",
          "Packaged into 12 convenient individual sachets within a lightweight travel bag, it makes an ideal companion for work, school, and trips, sharing heartfelt hometown affection.",
        ],
      },
    },
    5: {
      packaging: "Hộp 150g",
      rating: "OCOP 4★",
      badge: "100% Thuần Chay",
      tagline: {
        vi: "Thơm bùi vị đồng quê từ hạt đậu xanh ruột vàng nướng giòn rụm, 100% thuần chay thanh khiết",
        en: "Fragrant countryside flavor from golden mung beans, 100% vegetarian crispy baked cake",
      },
      lifestyleImage: "/products/p5_main.png",
      gallery: [
        "/products/p5_detail.png",
        "/products/cert_ocop.jpg",
        "/products/cert_atvstp.png",
      ],
      highlights: {
        vi: [
          "Nguyên liệu chọn lọc: Đậu xanh ta hạt nhỏ ruột vàng ngọt bùi đậm đà, đường mía, bột vani.",
          "Hoàn toàn không phụ gia, không chất bảo quản – đặc biệt thích hợp cho người ăn chay.",
          "Làng nghề truyền thống Khánh Mỹ trứ danh đất Tam Thành (Phú Ninh, Quảng Nam).",
          "Vị bánh giòn rụm, ngọt bùi tao nhã, hòa quyện tuyệt vời cùng tách trà ấm ban mai.",
        ],
        en: [
          "Selected local ingredients: Golden sweet mung beans, pure cane sugar, and natural vanilla aroma.",
          "100% vegetarian, zero additives, zero chemical preservatives.",
          "Crafted in historic Khanh My craft village, Tam Thanh, Phu Ninh, Quang Nam.",
          "Crunchy texture with delicate nutty sweetness, wonderful with hot morning tea.",
        ],
      },
      specs: {
        vi: [
          { label: "Tên sản phẩm", value: "Bánh đậu xanh chay Mỹ Khánh Bảo Linh 150g" },
          { label: "Thương hiệu", value: "Mỹ Khánh - Bảo Linh (Ocopia Heritage phân phối)" },
          { label: "Quy cách đóng gói", value: "Hộp 150g" },
          { label: "Hạn sử dụng", value: "45 ngày (bảo quản ngăn mát tủ lạnh: 60 ngày)" },
          { label: "Thành phần", value: "Đường, đậu xanh ta ruột vàng, bột vani (100% thuần chay)" },
          { label: "Hướng dẫn sử dụng", value: "Dùng liền sau khi mở nắp, ngon nhất khi nhâm nhi cùng trà ấm hoặc cà phê" },
          { label: "Hướng dẫn bảo quản", value: "Để nơi khô ráo, thoáng mát" },
          { label: "Nơi sản xuất", value: "Làng nghề Khánh Mỹ, Tam Thành, Phú Ninh, Quảng Nam" },
          { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP tỉnh Quảng Nam, Chứng nhận ATVSTP" },
        ],
        en: [
          { label: "Product Name", value: "My Khanh Vegetarian Mung Bean Cake 150g" },
          { label: "Brand", value: "My Khanh - Bao Linh (Distributed by Ocopia Heritage)" },
          { label: "Packaging", value: "150g Box" },
          { label: "Shelf Life", value: "45 days (60 days refrigerated)" },
          { label: "Ingredients", value: "Sugar, golden mung beans, vanilla (100% vegetarian)" },
          { label: "Usage Instructions", value: "Consume immediately after opening, best with hot tea" },
          { label: "Standard", value: "Quang Nam OCOP Certified, Food Hygiene Safety Certificate" },
        ],
      },
      story: {
        vi: [
          "Bên dòng Suối Dừng hiền hòa của vùng đất Tam Thành (Phú Ninh, Quảng Nam), Bánh đậu xanh hộp Mỹ Khánh ra đời như một thức quà chắt chiu từ tình đất và lòng người xứ Quảng.",
          "Từ những hạt đậu xanh ta hạt nhỏ ruột vàng ngọt bùi, người thợ lành nghề đã tỉ mỉ nướng nên từng chiếc bánh giòn tan đặc trưng. Mọi công đoạn đều giữ trọn sự mộc mạc, sạch lành, tuyệt đối không chất bảo quản hay phụ gia hóa chất.",
          "Cắn một miếng bánh Mỹ Khánh giòn rụm bên tách trà ấm hay ly cà phê sáng, vị bùi ngọt hòa quyện lan tỏa ngay đầu lưỡi. Đó không chỉ là món đặc sản thơm ngon, mà còn là gói trọn hương đồng gió nội và tình quê ấm áp dành cho người xa xứ lẫn khách phương xa.",
        ],
        en: [
          "By the peaceful Suoi Dung brook in Tam Thanh (Phu Ninh, Quang Nam), My Khanh Mung Bean Cake was born from the love of the land and people of Central Vietnam.",
          "From premium local golden mung beans, skilled artisans delicately bake each crispy, fragrant cake. Every step adheres strictly to wholesome purity, free of chemical additives and preservatives – 100% vegetarian.",
          "Enjoying a crispy My Khanh cake alongside a cup of warm tea or morning coffee releases a comforting nutty sweetness that brings warmth and nostalgic peace.",
        ],
      },
    },
    6: {
      packaging: "Hộp 150g",
      rating: "OCOP 4★",
      badge: "Nhân thịt heo quê",
      tagline: {
        vi: "Mặn ngọt hài hòa nhân thịt heo quê đậm đà bọc trong lớp vỏ đậu xanh giòn tan nức tiếng",
        en: "Savory-sweet harmony of local seasoned pork filling encased in crispy mung bean crust",
      },
      lifestyleImage: "/products/p6_main.png",
      gallery: [
        "/products/p6_detail.png",
        "/products/cert_ocop.jpg",
        "/products/cert_atvstp.png",
      ],
      highlights: {
        vi: [
          "Nhân thịt heo quê ướp gia vị đậm đà, mặn ngọt hài hòa bọc trong lớp vỏ đậu xanh nướng giòn rụm.",
          "Nguyên liệu tuyển chọn từ nông sản địa phương, không hóa chất độc hại, không phụ gia.",
          "Đặc sản truyền thống làng nghề Khánh Mỹ - biểu tượng ẩm thực tinh tế xứ Quảng.",
          "Bao bì hộp quà tinh tế, trang trọng, món quà gửi trọn nghĩa tình quê hương.",
        ],
        en: [
          "Savory pork filling delicately seasoned, enveloped by crunchy golden mung bean cake.",
          "Selected local agricultural ingredients, zero harmful chemicals or preservatives.",
          "Celebrated heritage craft of Khanh My village, a Quang Nam culinary treasure.",
          "Refined gift box, expressing the warm spirit and generosity of Central Vietnam.",
        ],
      },
      specs: {
        vi: [
          { label: "Tên sản phẩm", value: "Bánh đậu xanh thịt Mỹ Khánh Bảo Linh 150g" },
          { label: "Thương hiệu", value: "Mỹ Khánh - Bảo Linh (Ocopia Heritage phân phối)" },
          { label: "Quy cách đóng gói", value: "Hộp 150g" },
          { label: "Hạn sử dụng", value: "45 ngày (bảo quản ngăn mát tủ lạnh: 60 ngày)" },
          { label: "Thành phần", value: "Đường, đậu xanh ta ruột vàng, thịt heo quê chọn lọc, bột vani" },
          { label: "Hướng dẫn sử dụng", value: "Ăn liền sau khi mở gói, dùng cùng trà nóng hoặc cà phê" },
          { label: "Hướng dẫn bảo quản", value: "Để nơi khô ráo, thoáng mát" },
          { label: "Nơi sản xuất", value: "Làng nghề Khánh Mỹ, Tam Thành, Phú Ninh, Quảng Nam" },
          { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP tỉnh Quảng Nam, Chứng nhận ATVSTP" },
        ],
        en: [
          { label: "Product Name", value: "My Khanh Savory Pork Mung Bean Cake 150g" },
          { label: "Brand", value: "My Khanh - Bao Linh (Distributed by Ocopia Heritage)" },
          { label: "Packaging", value: "150g Box" },
          { label: "Shelf Life", value: "45 days (60 days refrigerated)" },
          { label: "Ingredients", value: "Sugar, golden mung beans, selected pork, vanilla" },
          { label: "Usage Instructions", value: "Ready to eat upon opening, superb with warm tea" },
          { label: "Standard", value: "Quang Nam OCOP Certified, Food Hygiene Safety Certificate" },
        ],
      },
      story: {
        vi: [
          "Sinh ra từ bãi bồi Khánh Mỹ và dòng Suối Dừng trong lành thuộc đất Tam Thành (Phú Ninh, Quảng Nam), Bánh đậu xanh hộp Mỹ Khánh không chỉ là một thức quà dân dã, mà là sự chắt chiu tinh túy của đất trời và lòng người xứ Quảng. Từ những hạt đậu xanh ta ruột vàng ươm, bùi ngọt tự nhiên kết hợp cùng nhân thịt heo quê đậm đà, chút mặn mòi của biển và ngọn lửa nướng giòn tan, từng chiếc bánh nhỏ nhắn ra đời mang theo trọn vẹn hương đồng gió nội.",
          "Không hóa chất, không chất bảo quản, mỗi chiếc bánh Mỹ Khánh là sự tôn trọng tuyệt đối dành cho sức khỏe người thưởng thức. Thả nhẹ một miếng bánh giòn rụm vào miệng bên tách trà nóng hay ly cà phê sáng, vị ngọt bùi hòa quyện cùng vị béo mặn tinh tế lan tỏa nơi đầu lưỡi, gợi thức bao ký ức bình yên về một vùng đất \"địa linh nhân kiệt\" thật thà, chất phác.",
          "Dù là thức quà ấm áp mang theo của những người con xa xứ hay món quà tinh tế gửi tặng bạn bè quốc tế, Bánh đậu xanh hộp Mỹ Khánh vẫn luôn trọn vẹn vai trò kết nối: đượm tình quê hương, tròn vị chân thành.",
        ],
        en: [
          "Originating from the fertile alluvial soil of Khanh My and the pure stream of Suoi Dung in Tam Thanh (Phu Ninh, Quang Nam), My Khanh Mung Bean Cake is a cherished culinary specialty of Central Vietnam.",
          "Featuring golden sweet mung beans combined with flavorful local pork filling, a hint of sea salt, and traditional baking techniques, every cake delivers a savory-sweet harmony wrapped in a crunchy crust.",
          "Free of artificial preservatives, it connects travelers and international friends to the authentic warmth and sincerity of Quang Nam heritage.",
        ],
      },
    },
    7: {
      packaging: "Túi 150g",
      rating: "OCOP 4★",
      badge: "Mít rừng sấy lạnh",
      tagline: {
        vi: "100% mít rừng Tiên Ngọc Tiên Phước sấy lạnh, giòn rụm giữ nguyên hương vị ngọt ngào tự nhiên",
        en: "100% wild jackfruit from Tien Ngoc freeze-dried, naturally crunchy and deliciously sweet",
      },
      lifestyleImage: "/products/p7_main.png",
      gallery: [
        "/products/p7_front.png",
        "/products/p7_back.png",
        "/products/cert_ocop.jpg",
        "/products/cert_atvstp.png",
      ],
      highlights: {
        vi: [
          "100% mít rừng Tiên Ngọc (Tiên Phước, Quảng Nam) chín cây tự nhiên tuyển chọn kỹ càng.",
          "Công nghệ sấy lạnh ở nhiệt độ thấp (độ ẩm dưới 40%) giữ trọn màu vàng tươi, chất xơ và vitamin quý giá.",
          "Không tẩm vị đường, không chất tạo màu, không chất bảo quản, an toàn lành mạnh cho cả trẻ nhỏ.",
          "Túi zip 150g tiện lợi, khóa kín sau khi dùng, dễ dàng mang theo khi đi làm, đi chơi du lịch.",
        ],
        en: [
          "100% wild jackfruit from Tien Ngoc, Tien Phuoc, Quang Nam, tree-ripened and hand-selected.",
          "Low-temperature freeze-drying technology preserving bright golden color, fiber, and vitamins.",
          "Zero added sugar, zero artificial colors, zero preservatives, safe and healthy for children.",
          "Convenient 150g resealable zipper pouch, easy to carry for work, study, or travel.",
        ],
      },
      specs: {
        vi: [
          { label: "Tên sản phẩm", value: "Mít sấy giòn QNA Farm 150g" },
          { label: "Thương hiệu", value: "QNA Farm (Ocopia Heritage phân phối)" },
          { label: "Quy cách đóng gói", value: "Túi zip 150g" },
          { label: "Hạn sử dụng", value: "12 tháng kể từ ngày sản xuất" },
          { label: "Thành phần", value: "100% mít rừng Tiên Ngọc sấy lạnh" },
          { label: "Hướng dẫn sử dụng", value: "Dùng ăn liền trực tiếp. Khóa kín miệng túi zip sau mỗi lần dùng" },
          { label: "Hướng dẫn bảo quản", value: "Để nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp" },
          { label: "Nơi sản xuất", value: "HTX QNA Farm, Tiên Phước, Quảng Nam" },
          { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP tỉnh Quảng Nam, Chứng nhận ATVSTP" },
        ],
        en: [
          { label: "Product Name", value: "QNA Farm Crispy Dried Jackfruit 150g" },
          { label: "Brand", value: "QNA Farm (Distributed by Ocopia Heritage)" },
          { label: "Packaging", value: "150g Resealable Bag" },
          { label: "Shelf Life", value: "12 months from manufacture date" },
          { label: "Ingredients", value: "100% wild Tien Ngoc jackfruit, low-temperature freeze dried" },
          { label: "Usage Instructions", value: "Ready to eat. Reseal zipper pouch tightly after opening" },
          { label: "Standard", value: "Quang Nam OCOP Certified, Food Hygiene Safety Certificate" },
        ],
      },
      story: {
        vi: [
          "Từ những vườn mít rừng Tiên Ngọc bạt ngàn nắng gió Tiên Phước, bà con HTX QNA Farm tỉ mỉ chọn từng múi mít chín cây, sấy lạnh giữ nguyên vị ngọt quê. Món quà vặt mộc mạc ấy mang theo cả hơi thở núi rừng xứ Quảng đến với mọi nhà, dù xa quê vẫn ấm lòng khi nếm thử.",
          "Mít chín tự nhiên sấy lạnh ở nhiệt độ thấp, giữ trọn màu vàng tươi, độ giòn xốp và dưỡng chất quý giá, tuyệt đối không chất bảo quản hay tẩm ướp phụ gia.",
        ],
        en: [
          "From the vast wild jackfruit orchards of Tien Ngoc in sunny Tien Phuoc, farmers of QNA Farm Cooperative carefully select tree-ripened jackfruits to freeze-dry into crispy, wholesome snacks.",
          "Processed at low temperatures below 40°C, it preserves vibrant natural golden color, fiber, and precious vitamins without added sugar, artificial colorants, or preservatives – a heartwarming taste of Central Vietnamese mountains.",
        ],
      },
    },
    8: {
      packaging: "Túi 125g",
      rating: "OCOP 4★",
      badge: "ISO 22000:2018",
      tagline: {
        vi: "Bữa phụ lành mạnh từ 6 loại hạt quê kết hợp chuối xanh Tiên Phước, xốp giòn giàu dinh dưỡng",
        en: "Nutritious snack crafted from 6 native grains and green bananas from Tien Phuoc",
      },
      lifestyleImage: "/products/p8_main.png",
      gallery: [
        "/products/p8_detail.png",
        "/products/cert_ocop.jpg",
        "/products/cert_atvstp.png",
      ],
      highlights: {
        vi: [
          "Kết hợp 6 loại hạt quê bổ dưỡng: Gạo nguyên cám, đậu xanh, chuối xanh, ngô nếp, yến mạch, đậu đỏ và đường mía hữu cơ.",
          "Không chiên dầu, không chất bảo quản, không hương liệu hóa học, không phẩm màu nhân tạo.",
          "Giàu chất xơ và đạm thực vật, hỗ trợ tiêu hóa tốt cho trẻ em, người ăn kiêng, tập luyện và người lớn tuổi.",
          "Sản xuất tại cơ sở đạt tiêu chuẩn an toàn thực phẩm quốc tế ISO 22000:2018.",
        ],
        en: [
          "Wholesome blend of 6 local grains: Wholegrain rice, mung bean, green banana, sticky corn, oats, red bean, organic cane sugar.",
          "Non-fried, zero preservatives, zero artificial flavorings, zero synthetic food colors.",
          "Rich in dietary fiber and plant proteins, supporting healthy digestion for all ages.",
          "Produced in an international ISO 22000:2018 food safety certified facility.",
        ],
      },
      specs: {
        vi: [
          { label: "Tên sản phẩm", value: "Viên ngũ cốc chuối xanh QNA Farm 125g" },
          { label: "Thương hiệu", value: "QNA Farm (Ocopia Heritage phân phối)" },
          { label: "Quy cách đóng gói", value: "Túi 125g (chia nhỏ 40g/gói tiện lợi)" },
          { label: "Hạn sử dụng", value: "3 tháng kể từ ngày sản xuất (dùng trong 5 ngày sau khi mở)" },
          { label: "Thành phần", value: "Gạo nguyên cám, đậu xanh, chuối xanh, ngô nếp, yến mạch, đậu đỏ, đường mía hữu cơ" },
          { label: "Hướng dẫn sử dụng", value: "Dùng ăn liền hoặc kết hợp cùng sữa chua, sữa hạt, trái cây tươi" },
          { label: "Hướng dẫn bảo quản", value: "Bảo quản nơi khô ráo hoặc ngăn mát tủ lạnh" },
          { label: "Nơi sản xuất", value: "HTX QNA Farm, Tiên Phước, Quảng Nam (Đạt chuẩn ISO 22000:2018)" },
          { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP tỉnh Quảng Nam, Chứng nhận ISO 22000:2018" },
        ],
        en: [
          { label: "Product Name", value: "QNA Farm Green Banana Multigrain Bites 125g" },
          { label: "Brand", value: "QNA Farm (Distributed by Ocopia Heritage)" },
          { label: "Packaging", value: "125g Bag (40g sachets)" },
          { label: "Shelf Life", value: "3 months from manufacture date" },
          { label: "Ingredients", value: "Wholegrain rice, mung bean, green banana, sticky corn, oats, red bean, organic cane sugar" },
          { label: "Usage Instructions", value: "Eat directly or pair with yogurt, plant milk, fresh fruits" },
          { label: "Standard", value: "Quang Nam OCOP Certified, ISO 22000:2018 Certified" },
        ],
      },
      story: {
        vi: [
          "Thấu hiểu nỗi lo của các mẹ khi con thích ăn vặt mà sợ đồ nhiều dầu mỡ, bà con HTX QNA Farm ở Tiên Phước dày công nghiên cứu, kết hợp 6 loại hạt quê rang thủ công cùng chuối xanh. Từng viên ngũ cốc xốp giòn, ngọt dịu là tấm lòng \"sạch – lành – thuận tự nhiên\" gửi đến từng gia đình.",
          "Bữa phụ tiện lợi giàu chất xơ và đạm thực vật, gắn kết tình thân gia đình qua từng bữa ăn nhẹ ngọt lành, an tâm cho sức khỏe người thân yêu.",
        ],
        en: [
          "Understanding the concern of parents seeking wholesome, non-greasy snacks for their children, QNA Farm in Tien Phuoc developed this blend of 6 native grains hand-roasted with green bananas.",
          "Each crispy, naturally sweet multigrain bite represents a 'clean, wholesome, natural' commitment, packed with dietary fiber and plant protein to nourish every family member.",
        ],
      },
    },
  };

  // Static products list - 8 new products
  const STATIC_PRODUCTS: Product[] = [
    {
      id: 1,
      name: "Bánh dừa gạo lứt đậu xanh Bảo Linh",
      price: 39000,
      image_url: "/products/p1_main.png",
      story: `Kế thừa trọn vẹn tinh túy của làng nghề đặc sản xứ Quảng, Bánh Dừa Nướng Gạo Lứt Đậu Xanh Bảo Linh là sự giao thoa hoàn hảo giữa công thức truyền thống lâu đời và những sản vật mộc mạc từ thiên nhiên. Từng chiếc bánh được chắt chiu từ cơm dừa tươi nguyên chất béo ngậy, bột nếp dẻo thơm, kết hợp cùng gạo lứt bổ dưỡng, vị bùi thanh của đậu xanh và những hạt mè vàng thơm lừng. Qua ngọn lửa nướng vừa độ, bánh đạt tới độ giòn rụm đặc trưng. Cắn một miếng, vị ngọt bùi của dừa và đậu xanh hòa cùng hương thơm thanh nhã của gạo lứt và mè rang ngay lập tức lan tỏa, gợi thức trọn vẹn hương vị mặn mòi, ấm áp của đất và người miền Trung.`,
    },
    {
      id: 2,
      name: "Bánh dừa gạo lứt mè Bảo Linh",
      price: 39000,
      image_url: "/products/p2_main.png",
      story: `Từ mảnh đất Quảng Nam dạt dào nắng gió, Bánh Dừa Nướng Gạo Lứt Mè Bảo Linh kế thừa trọn vẹn nét đẹp của công thức truyền thống lâu đời, biến những sản vật mộc mạc quê nhà thành thức quà tinh tế, giòn tan. Sự kết hợp hoàn hảo giữa cơm dừa tươi nguyên chất béo bùi, bột nếp dẻo thơm cùng hạt gạo lứt bổ dưỡng và những hạt mè vàng ươm đã tạo nên nét chấm phá đầy khác biệt. Qua bàn tay chăm chút của người thợ và ngọn lửa nướng vừa độ, từng chiếc bánh ra đời mang hương thơm lừng quyến rũ. Cắn nhẹ một miếng, tiếng giòn rụm vang lên vui tai, lập tức lan tỏa vị ngọt thanh tự nhiên của dừa tươi, vị béo bùi đậm đà của mè rang.`,
    },
    {
      id: 3,
      name: "Bánh dừa nướng Bảo Linh hộp 250g",
      price: 39000,
      image_url: "/products/p3_main.png",
      story: `Từ những rặng dừa xanh mướt ngập tràn ánh nắng nhiệt đới, câu chuyện của Bánh dừa Bảo Linh bắt đầu khi nét dân dã ấy dừng chân tại xứ Quảng. Bằng sự tỉ mỉ và tình yêu sản vật quê nhà, Bảo Linh đã biến những cùi dừa tươi quen thuộc thành món bánh nướng giòn tan, chinh phục trọn vẹn cả những thực khách khó tính nhất. Mỗi chiếc bánh là sự kết tinh hoàn toàn từ thiên nhiên: cơm dừa tươi béo ngậy, bột nếp thơm lừng, chút đường ngọt đậm và hương vani thoang thoảng. Không hóa chất, không phụ gia, quy trình chế biến an toàn tuyệt đối giúp giữ trọn nét thuần khiết của nguyên liệu.`,
    },
    {
      id: 4,
      name: "Bánh dừa nướng Bảo Linh gói 150g",
      price: 28000,
      image_url: "/products/p4_main.png",
      story: `Khoác lên mình chiếc áo màu xanh mát – biểu tượng mộc mạc của những tà lá dừa quê hương, Bánh dừa gói Bảo Linh mang vẻ đẹp giản dị, gần gũi. Gọn nhẹ, dễ bảo quản và đượm tình, đây không chỉ là món ăn vặt vui tai vui miệng mà còn là món quà du lịch tinh tế, gửi trao trọn vẹn sự chân thành và ký ức ngọt ngào sau mỗi chuyến đi xa. Bằng sự tỉ mỉ và tình yêu sản vật quê nhà, Bảo Linh đã biến những cùi dừa tươi quen thuộc thành món bánh nướng giòn tan, chinh phục trọn vẹn cả những thực khách khó tính nhất.`,
    },
    {
      id: 5,
      name: "Bánh đậu xanh chay Mỹ Khánh Bảo Linh",
      price: 39000,
      image_url: "/products/p5_main.png",
      story: `Bên dòng Suối Dừng hiền hòa của vùng đất Tam Thành (Phú Ninh, Quảng Nam), Bánh đậu xanh hộp Mỹ Khánh ra đời như một thức quà chắt chiu từ tình đất và lòng người xứ Quảng. Từ những hạt đậu xanh ta hạt nhỏ ruột vàng ngọt bùi, người thợ lành nghề đã tỉ mỉ nướng nên từng chiếc bánh giòn tan đặc trưng. Mọi công đoạn đều giữ trọn sự mộc mạc, sạch lành, tuyệt đối không chất bảo quản hay phụ gia hóa chất. Cắn một miếng bánh Mỹ Khánh giòn rụm bên tách trà ấm hay ly cà phê sáng, vị bùi ngọt hòa quyện lan tỏa ngay đầu lưỡi.`,
    },
    {
      id: 6,
      name: "Bánh đậu xanh thịt Mỹ Khánh Bảo Linh",
      price: 39000,
      image_url: "/products/p6_main.png",
      story: `Sinh ra từ bãi bồi Khánh Mỹ và dòng Suối Dừng trong lành thuộc đất Tam Thành (Phú Ninh, Quảng Nam), Bánh đậu xanh hộp Mỹ Khánh không chỉ là một thức quà dân dã, mà là sự chắt chiu tinh túy của đất trời và lòng người xứ Quảng. Từ những hạt đậu xanh ta ruột vàng ươm, bùi ngọt tự nhiên kết hợp cùng nhân thịt heo quê đậm đà, chút mặn mòi của biển và ngọn lửa nướng giòn tan, từng chiếc bánh nhỏ nhắn ra đời mang theo trọn vẹn hương đồng gió nội. Không hóa chất, không chất bảo quản, mỗi chiếc bánh Mỹ Khánh là sự tôn trọng tuyệt đối dành cho sức khỏe người thưởng thức.`,
    },
    {
      id: 7,
      name: "Mít sấy giòn QNA Farm",
      price: 50000,
      image_url: "/products/p7_main.png",
      story: `Từ những vườn mít rừng Tiên Ngọc bạt ngàn nắng gió Tiên Phước, bà con HTX QNA Farm tỉ mỉ chọn từng múi mít chín cây, sấy lạnh giữ nguyên vị ngọt quê. Món quà vặt mộc mạc ấy mang theo cả hơi thở núi rừng xứ Quảng đến với mọi nhà, dù xa quê vẫn ấm lòng khi nếm thử. Mít chín tự nhiên sấy lạnh ở nhiệt độ thấp, giữ trọn độ giòn xốp và dưỡng chất quý giá, tuyệt đối không chất bảo quản hay tẩm ướp phụ gia.`,
    },
    {
      id: 8,
      name: "Viên ngũ cốc chuối xanh QNA Farm",
      price: 50000,
      image_url: "/products/p8_main.png",
      story: `Thấu hiểu nỗi lo của các mẹ khi con thích ăn vặt mà sợ đồ nhiều dầu mỡ, bà con HTX QNA Farm ở Tiên Phước dày công nghiên cứu, kết hợp 6 loại hạt quê rang thủ công cùng chuối xanh. Từng viên ngũ cốc xốp giòn, ngọt dịu là tấm lòng "sạch – lành – thuận tự nhiên" gửi đến từng gia đình. Không chiên dầu, không chất bảo quản, không hương liệu nhân tạo, thích hợp dùng làm bữa phụ giàu dinh dưỡng cho cả gia đình.`,
    },
  ];

  useEffect(() => {
    async function fetchProducts() {
      try {
        // Nạp danh sách 8 sản phẩm mới
        setProducts(STATIC_PRODUCTS);
      } catch (err: any) {
        console.error(err);
        setProducts(STATIC_PRODUCTS);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCheckout = (product: Product, qty: number = 1) => {
    setActiveProduct(product);
    setQuantity(qty);
    setCheckoutItems([{ product, quantity: qty }]);
    setPaymentMethod("cod");
    setFormData({ customerName: "", phone: "", address: "" });
    setIsCheckoutOpen(true);
    setIsSuccess(false);
    setCreatedOrderId("");
  };

  const openCartCheckout = () => {
    if (selectedCartItems.length === 0) {
      alert(t.selectAtLeastOne || (lang === "vi" ? "Vui lòng chọn ít nhất 1 sản phẩm để thanh toán." : "Please select at least 1 item to proceed to checkout."));
      return;
    }
    setActiveProduct(selectedCartItems[0].product);
    setQuantity(selectedTotalCount);
    setCheckoutItems(
      selectedCartItems.map((item) => ({ product: item.product, quantity: item.quantity }))
    );
    setPaymentMethod("cod");
    setFormData({ customerName: "", phone: "", address: "" });
    setIsCheckoutOpen(true);
    setIsSuccess(false);
    setCreatedOrderId("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;

    if (!formData.customerName.trim() || !formData.phone.trim() || !formData.address.trim()) {
      alert(t.fillAllFields);
      return;
    }

    setIsSubmitting(true);
    try {
      const currentOrderTotal = checkoutItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const totalPrice = currentOrderTotal > 0 ? currentOrderTotal : (activeProduct.price * quantity);
      const orderStatus = paymentMethod === "cod" ? "COD_CONFIRMED" : "Pending";
      const checkoutTitle =
        checkoutItems.length === 1
          ? (t.products?.[String(checkoutItems[0].product.id)]?.name || checkoutItems[0].product.name)
          : `${t.products?.[String(checkoutItems[0].product.id)]?.name || checkoutItems[0].product.name} + ${checkoutItems.length - 1} ${lang === "vi" ? "sản phẩm khác" : "other items"}`;

      const itemsList = checkoutItems.length > 0
        ? checkoutItems
        : [{ product: activeProduct, quantity }];

      const itemsSummary = itemsList
        .map(
          (item) =>
            `${item.quantity}x ${item.product.name} (${(item.product.price * item.quantity).toLocaleString("vi-VN")}đ)`
        )
        .join(", ");

      const primaryProductId = itemsList[0]?.product?.id || null;
      const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");

      const orderPayload: Record<string, any> = {
        customer_name: formData.customerName,
        phone: formData.phone,
        address: formData.address,
        total_price: totalPrice,
        payment_method: paymentMethod.toUpperCase(),
        status: orderStatus,
        product_id: primaryProductId,
        items: itemsSummary,
        created_at: vnNow,
        updated_at: vnNow,
      };

      let insertResult = await supabase.from("orders").insert(orderPayload).select();

      // Nếu cột 'items' chưa được tạo trong Supabase (PGRST204), tự động fallback lưu không có 'items'
      if (insertResult.error && insertResult.error.code === "PGRST204") {
        delete orderPayload.items;
        insertResult = await supabase.from("orders").insert(orderPayload).select();
      }

      if (insertResult.error) throw insertResult.error;

      const insertedOrder = insertResult.data?.[0];
      const orderId = insertedOrder?.id || insertedOrder?.order_id || "OCP-" + Math.floor(100000 + Math.random() * 900000);
      setCreatedOrderId(String(orderId));

      if (paymentMethod === "banking") {
        const checkoutResponse = await fetch("/api/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId: orderId,
            totalPrice: totalPrice,
            productName: checkoutTitle,
            origin: window.location.origin,
          }),
        });

        const checkoutData = await checkoutResponse.json();

        if (checkoutResponse.ok && checkoutData.checkoutUrl) {
          // Hiển QR trực tiếp trên trang thay vì redirect sang PayOS
          setBankingQR({
            qrCode: checkoutData.qrCode || "",
            orderId: Number(orderId),
            checkoutUrl: checkoutData.checkoutUrl,
          });
          // Remove purchased items from cart
          if (checkoutItems.length > 0) {
            const checkedIds = checkoutItems.map((ci) => ci.product.id);
            updateCart(cart.filter((item) => !checkedIds.includes(item.product.id)));
          }
        } else {
          throw new Error(checkoutData.error || "Không thể khởi tạo cổng thanh toán PayOS.");
        }
      } else {
        // COD: insert vào bảng completed_orders
        const completedPayload: Record<string, any> = {
          order_id: insertedOrder?.id,
          customer_name: formData.customerName,
          phone: formData.phone,
          address: formData.address,
          total_price: totalPrice,
          payment_method: "COD",
          status: "COD_CONFIRMED",
          items: itemsSummary,
          created_at: vnNow,
        };

        let compRes = await supabase.from("completed_orders").insert(completedPayload);
        if (compRes.error && compRes.error.code === "PGRST204") {
          delete completedPayload.items;
          compRes = await supabase.from("completed_orders").insert(completedPayload);
        }

        if (compRes.error) {
          console.error("Lỗi khi lưu đơn COD vào completed_orders:", compRes.error);
        } else {
          console.log(`Đơn hàng COD #${insertedOrder?.id} đã được lưu vào completed_orders.`);
        }

        // Remove purchased items from cart
        if (checkoutItems.length > 0) {
          const checkedIds = checkoutItems.map((ci) => ci.product.id);
          updateCart(cart.filter((item) => !checkedIds.includes(item.product.id)));
        }

        setIsSuccess(true);
      }
    } catch (err: any) {
      console.error(err);
      alert(t.orderError + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProductTrustPoints = (id: number) => {
    if (id === 1) {
      return [
        "100% nguyên liệu thuần nông: Nếp Hương, Mè mẩy, Gừng sẻ tươi",
        "Quy trình 7 bước thủ công truyền thống ròng rã suốt 3 ngày",
        "Đạt chuẩn OCOP 4 Sao Đà Nẵng, không chất bảo quản",
      ];
    }
    return [
      "Mực ống tươi 100% đánh bắt tự nhiên tại vùng biển Đà Nẵng",
      "Xốt me gia truyền màu tự nhiên, tuyệt đối không chất bảo quản",
      "Đóng lon PET nắp nhôm xé màng seal hiện đại, đảm bảo vệ sinh",
    ];
  };

  const parseStory = (storyText: string) => {
    const sentences = storyText.split(/(?<=\. )/);
    if (sentences.length > 2) {
      const hook = sentences.slice(0, 2).join(" ");
      const core = sentences.slice(2).join(" ");
      return { hook, core };
    }
    return { hook: storyText, core: "" };
  };

  const renderCheckoutModal = () => {
    if (!isCheckoutOpen || !activeProduct) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
          onClick={() => !isSubmitting && setIsCheckoutOpen(false)}
        ></div>

        {/* Modal Container */}
        <div className="relative w-full max-w-2xl glass-panel border border-white/10 rounded-md overflow-hidden z-10 max-h-[90vh] flex flex-col text-left">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-dark-bg/40">
            <h3 className="font-serif text-lg tracking-widest text-gold-accent uppercase">
              {bankingQR ? t.qrTitle : isSuccess ? t.checkoutSuccess : t.checkoutTitle}
            </h3>
            {!isSubmitting && (
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-grow space-y-6">
            {bankingQR ? (
              /* Banking QR + Countdown View */
              <div className="text-center space-y-6 py-4">
                {/* Countdown Timer */}
                <div className="space-y-1">
                  <p className="font-mono text-xs tracking-widest text-[#eaeaea]/40 uppercase">{t.qrTimeRemaining}</p>
                  <div className={`font-serif text-5xl font-bold tabular-nums ${
                    qrCountdown <= 60 ? "text-red-400" : qrCountdown <= 120 ? "text-amber-400" : "text-gold"
                  }`}>
                    {String(Math.floor(qrCountdown / 60)).padStart(2, "0")}:{String(qrCountdown % 60).padStart(2, "0")}
                  </div>
                  <p className="font-sans text-[10px] text-[#eaeaea]/40">
                    {qrCountdown <= 60 ? t.qrExpiring : t.qrExpiry}
                  </p>
                </div>

                {/* QR Code */}
                <div className="relative w-52 h-52 mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-r from-gold/30 to-gold-accent/20 rounded-lg blur opacity-40"></div>
                  <div className="relative bg-white rounded-lg p-3 border border-gold/20 shadow-xl">
                    {bankingQR.qrCode ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(bankingQR.qrCode)}&size=200x200&color=0A0B0F&bgcolor=FFFFFF`}
                        alt="Mã QR Thanh toán PayOS"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Đang tải mã QR...</div>
                    )}
                  </div>
                </div>

                {/* Payment Info */}
                <div className="glass-panel border border-white/5 rounded p-4 text-left space-y-2 bg-white/[0.02] text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#eaeaea]/40">{t.qrLabelOrderId}</span>
                    <span className="font-mono font-bold text-gold-accent">#{bankingQR.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#eaeaea]/40">{t.qrLabelAmount}</span>
                    <span className="font-bold text-white">{activeProduct ? (activeProduct.price * quantity).toLocaleString("vi-VN") : ""} VNĐ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#eaeaea]/40">{t.qrLabelContent}</span>
                    <span className="font-mono text-white">Thanh toan don {bankingQR.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#eaeaea]/40">{t.vietqrHolder}</span>
                    <span className="font-bold text-white">DANG XUAN HUNG</span>
                  </div>
                </div>

                <p className="font-sans text-[10px] text-[#eaeaea]/40 italic">
                  {t.qrAutoConfirm}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      supabase.from("orders").update({ status: "Cancelled" }).eq("id", bankingQR.orderId)
                        .then(() => {
                          setBankingQR(null);
                          setIsCheckoutOpen(false);
                          setPaymentRedirectStatus({ status: "cancelled", orderId: String(bankingQR.orderId) });
                        });
                    }}
                    className="flex-1 border border-white/15 hover:border-red-500/50 text-white/60 hover:text-red-400 font-serif text-xs tracking-widest py-3 px-4 rounded-sm transition-colors"
                  >
                    {t.qrCancelBtn}
                  </button>
                  <a
                    href={bankingQR.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 border border-gold/30 hover:border-gold text-gold/70 hover:text-gold font-serif text-xs tracking-widest py-3 px-4 rounded-sm transition-colors flex items-center justify-center gap-1"
                  >
                    {t.qrOpenPayos}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ) : isSuccess ? (
              /* Success View */
              <div className="text-center space-y-6 py-6">
                <div className="w-16 h-16 bg-gold/10 border border-gold/30 rounded-full flex items-center justify-center mx-auto text-gold animate-pulse">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h4 className="font-serif text-2xl text-white">{t.thankYou}</h4>
                  <p className="font-sans text-xs text-[#eaeaea]/60">
                    {t.orderRecorded}
                  </p>
                </div>

                {/* Order Details Receipt */}
                <div className="glass-panel border border-white/5 rounded p-4 text-left space-y-3 bg-white/[0.02]">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelOrderId}</span>
                    <span className="text-xs font-mono font-bold text-gold-accent">{createdOrderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelCustomer}</span>
                    <span className="text-xs font-medium text-white">{formData.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelPhoneReceipt}</span>
                    <span className="text-xs font-medium text-white">{formData.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelDeliveryAddr}</span>
                    <span className="text-xs font-medium text-white text-right max-w-[70%] truncate">
                      {formData.address}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelProduct}</span>
                    <span className="text-xs font-medium text-white text-right max-w-[70%]">
                      {checkoutItems.map((ci) => `${t.products?.[String(ci.product.id)]?.name || ci.product.name} (x${ci.quantity})`).join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2">
                    <span className="text-sm font-bold text-gold-light">{t.labelTotal}</span>
                    <span className="text-sm font-bold text-gold-light font-serif">
                      {checkoutItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toLocaleString("vi-VN")} VNĐ
                    </span>
                  </div>
                </div>

                {/* Banking VietQR Code block */}
                {paymentMethod === "banking" && (
                  <div className="glass-panel border border-gold/20 rounded p-5 space-y-4 bg-gold/[0.02] text-center">
                    <span className="text-xs font-mono tracking-widest text-gold block">
                      {t.vietqrTitle}
                    </span>
                    <div className="relative w-48 h-48 mx-auto border border-white/10 rounded overflow-hidden bg-white p-2">
                      <img
                        src={`https://img.vietqr.io/image/MB-123456789-compact2.png?amount=${checkoutItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)}&addInfo=${createdOrderId}&accountName=DANG%20XUAN%20HUNG`}
                        alt="VietQR Payment Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-left space-y-2 text-xs text-[#eaeaea]/70 max-w-sm mx-auto">
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">{t.vietqrBank}</span> <span className="font-semibold text-white">MB Bank</span></p>
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">{t.vietqrAccount}</span> <span className="font-semibold text-white">123456789</span></p>
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">{t.vietqrHolder}</span> <span className="font-semibold text-white">DANG XUAN HUNG</span></p>
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">{t.vietqrDesc}</span> <span className="font-mono font-bold text-gold-accent">{createdOrderId}</span></p>
                    </div>
                    <p className="text-[10px] text-gold-accent/50 italic max-w-sm mx-auto">
                      {t.vietqrSystemAuto}
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={() => {
                      setIsCheckoutOpen(false);
                      handleCloseDetail(); // return to catalog on complete
                    }}
                    className="w-full font-serif text-xs tracking-widest bg-gold text-dark-bg font-semibold py-3 px-8 rounded-sm hover:bg-gold-light transition-colors cursor-pointer"
                  >
                    {t.doneBtn}
                  </button>
                </div>
              </div>
            ) : (
              /* Checkout Form View */
              <form onSubmit={handleSubmitOrder} className="space-y-6">
                {/* Selected Products Summary Cards */}
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {checkoutItems.map((ci, idx) => (
                    <div key={idx} className="flex gap-3 p-3 border border-white/5 rounded-sm bg-white/[0.01] items-center">
                      <img
                        src={ci.product.image_url}
                        alt={ci.product.name}
                        className="w-14 h-14 object-cover rounded border border-white/5 shrink-0"
                      />
                      <div className="flex-grow min-w-0">
                        <h4 className="font-serif text-sm text-white truncate">
                          {t.products?.[String(ci.product.id)]?.name || ci.product.name}
                        </h4>
                        <p className="text-xs text-gold-accent font-serif mt-0.5">
                          {ci.product.price.toLocaleString("vi-VN")} VNĐ x {ci.quantity}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-serif text-sm text-gold font-bold">
                          {(ci.product.price * ci.quantity).toLocaleString("vi-VN")} VNĐ
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center px-1 pt-1 border-t border-white/5">
                  <span className="text-xs text-[#eaeaea]/50 uppercase tracking-widest">{t.subtotal}</span>
                  <span className="font-serif text-lg text-gold font-bold">
                    {checkoutItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toLocaleString("vi-VN")} VNĐ
                  </span>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono">
                      {t.labelName} <span className="text-gold">*</span>
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      className="w-full bg-[#14151a]/80 border border-white/10 focus:border-gold focus:outline-none rounded-sm px-4 py-2.5 text-sm text-white font-sans transition-colors placeholder:text-white/20"
                      placeholder={t.placeholderName}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono">
                      {t.labelPhone} <span className="text-gold">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      className="w-full bg-[#14151a]/80 border border-white/10 focus:border-gold focus:outline-none rounded-sm px-4 py-2.5 text-sm text-white font-sans transition-colors placeholder:text-white/20"
                      placeholder={t.placeholderPhone}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono">
                      {t.labelAddress} <span className="text-gold">*</span>
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                      rows={3}
                      disabled={isSubmitting}
                      className="w-full bg-[#14151a]/80 border border-white/10 focus:border-gold focus:outline-none rounded-sm px-4 py-2.5 text-sm text-white font-sans transition-colors placeholder:text-white/20"
                      placeholder={t.placeholderAddress}
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono block">
                    {t.paymentMethod}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* COD Box */}
                    <label
                      className={`flex flex-col p-4 border rounded-sm cursor-pointer transition-all duration-300 ${
                        paymentMethod === "cod"
                          ? "border-gold bg-gold/5"
                          : "border-white/10 hover:border-white/25 bg-[#14151a]/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cod"
                        checked={paymentMethod === "cod"}
                        onChange={() => setPaymentMethod("cod")}
                        className="sr-only"
                        disabled={isSubmitting}
                      />
                      <span className="text-xs font-serif font-bold text-white uppercase tracking-wider">
                        {t.codTitle}
                      </span>
                      <span className="text-[10px] text-[#eaeaea]/55 mt-1">
                        {t.codDesc}
                      </span>
                    </label>

                    {/* Banking Box */}
                    <label
                      className={`flex flex-col p-4 border rounded-sm cursor-pointer transition-all duration-300 ${
                        paymentMethod === "banking"
                          ? "border-gold bg-gold/5"
                          : "border-white/10 hover:border-white/25 bg-[#14151a]/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="banking"
                        checked={paymentMethod === "banking"}
                        onChange={() => setPaymentMethod("banking")}
                        className="sr-only"
                        disabled={isSubmitting}
                      />
                      <span className="text-xs font-serif font-bold text-white uppercase tracking-wider">
                        {t.bankingTitle}
                      </span>
                      <span className="text-[10px] text-[#eaeaea]/55 mt-1">
                        {t.bankingDesc}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsCheckoutOpen(false)}
                    disabled={isSubmitting}
                    className="w-1/3 border border-white/15 hover:border-white/30 text-white font-serif text-xs tracking-widest py-3.5 px-6 rounded-sm transition-colors"
                  >
                    {t.cancelBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3 font-serif text-xs tracking-widest bg-gold text-dark-bg font-semibold py-3.5 px-8 rounded-sm hover:bg-gold-light transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-dark-bg border-t-transparent"></div>
                        {t.processingBtn}
                      </>
                    ) : (
                      t.confirmBtn
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRedirectStatusModal = () => {
    if (!paymentRedirectStatus) return null;

    const isSuccess = paymentRedirectStatus.status === "success";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
          onClick={() => setPaymentRedirectStatus(null)}
        ></div>

        {/* Modal Container */}
        <div className="relative w-full max-w-md glass-panel border border-white/10 rounded-md overflow-hidden z-10 p-8 text-center space-y-6">
          {isSuccess ? (
            <>
              <div className="w-16 h-16 bg-gold/10 border border-gold/30 rounded-full flex items-center justify-center mx-auto text-gold animate-bounce">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-2xl text-white uppercase tracking-wider">{t.paymentSuccessTitle}</h3>
                <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed">
                  {t.redirectSuccessDesc1} <span className="font-mono text-gold-accent font-bold">#{paymentRedirectStatus.orderId}</span> {t.redirectSuccessDesc2}
                </p>
                <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed">
                  {t.redirectSuccessDesc3}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-2xl text-white uppercase tracking-wider">{t.paymentCancelledTitle}</h3>
                <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed">
                  {t.redirectCancelledDesc1} <span className="font-mono text-gold-accent font-bold">#{paymentRedirectStatus.orderId}</span> {t.redirectCancelledDesc2}
                </p>
                <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed">
                  {t.redirectCancelledDesc3}
                </p>
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              onClick={() => setPaymentRedirectStatus(null)}
              className="w-full font-serif text-xs tracking-widest bg-gold text-dark-bg font-semibold py-3 px-8 rounded-sm hover:bg-gold-light transition-colors"
            >
              {t.closeBtn}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (activeDetailProduct) {
    const localizedProduct = t.products?.[String(activeDetailProduct.id)];
    const meta = PRODUCT_METADATA[activeDetailProduct.id];

    // Gallery images (excluding the 4:3 lifestyle photo)
    const galleryImages = meta?.gallery || [activeDetailProduct.image_url];
    const currentImg =
      selectedDetailImage && galleryImages.includes(selectedDetailImage)
        ? selectedDetailImage
        : galleryImages[0] || activeDetailProduct.image_url;

    // Tagline (under title)
    const productTagline = meta?.tagline?.[lang] || activeDetailProduct.story.slice(0, 120);

    // Specifications (Thông tin sản phẩm)
    const specs = meta?.specs?.[lang] || [];

    // Story paragraphs for the middle section (from Content SP.txt)
    const productStoryParagraphs = meta?.story?.[lang] || [activeDetailProduct.story];

    // Related products (Sản phẩm bạn có thể thích)
    const relatedProducts = products.filter((p) => p.id !== activeDetailProduct.id);

    return (
      <div className="relative min-h-screen flex flex-col overflow-x-hidden font-sans">
        {/* Background Decorative Blur Lines */}
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px] pointer-events-none"></div>
        <div className="absolute bottom-[30%] right-[-10%] w-[600px] h-[600px] bg-gold-accent/5 rounded-full blur-[150px] pointer-events-none"></div>

        {/* Top Announcement Bar */}
        <aside className="w-full bg-[#18140c] text-gold-light/95 border-b border-gold/20 py-2 px-4 text-xs font-sans tracking-wide">
          <div className="max-w-7xl mx-auto text-center font-medium truncate">
            <span>{t.topBarText || "SIÊU ƯU ĐÃI NÔNG SẢN VIỆT - MIỄN PHÍ VẬN CHUYỂN TOÀN QUỐC CHO ĐƠN TỪ 200.000Đ"}</span>
          </div>
        </aside>

        {/* Header */}
        <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5 py-3.5 px-4 md:px-12 flex items-center justify-between gap-4">
          <div
            onClick={() => {
              handleCloseDetail();
              navigateTo("home");
            }}
            className="flex items-center gap-3 group shrink-0 cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-gold/40 shadow-sm p-0.5 bg-dark-bg/60 group-hover:border-gold transition-colors">
              <img
                src="/background.jpg"
                alt="Ocopia Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl sm:text-2xl font-bold tracking-[0.2em] gold-gradient-text uppercase leading-none">
                  Ocopia
                </span>
                <span className="text-[9px] uppercase font-mono tracking-widest bg-gold/10 text-gold-accent border border-gold/20 px-1.5 py-0.5 rounded hidden sm:inline-block">
                  Heritage
                </span>
              </div>
              <span className="text-[9px] font-sans text-[#eaeaea]/50 tracking-wider hidden md:block">
                {lang === "vi" ? "Đặc sản OCOP Việt Nam" : "Vietnamese OCOP Heritage"}
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-serif text-xs tracking-[0.18em] uppercase">
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("products");
              }}
              className="text-gold font-bold border-b-2 border-gold transition-all duration-300 cursor-pointer py-1"
            >
              {t.navProducts || "SẢN PHẨM"}
            </button>
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("home");
                setTimeout(() => {
                  const el = document.getElementById("about");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="text-[#eaeaea]/85 hover:text-gold transition-colors font-medium cursor-pointer py-1"
            >
              {t.navStory || "CÂU CHUYỆN"}
            </button>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("cart");
              }}
              className="relative p-2 text-gold hover:text-gold-light transition-colors rounded-full hover:bg-gold/5 cursor-pointer"
              aria-label="Shopping Cart"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="absolute top-0.5 right-0.5 bg-gold text-dark-bg text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center font-mono shadow-sm">
                {totalCartCount}
              </span>
            </button>

            <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>

            <button
              onClick={toggleTheme}
              className="text-gold hover:text-gold-light transition-colors p-1"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={toggleLang}
              className="font-serif text-[11px] font-bold tracking-widest text-[#eaeaea]/85 hover:text-gold transition-colors border border-white/10 hover:border-gold/50 rounded px-2 py-0.5"
              aria-label="Toggle language"
            >
              {lang === "vi" ? "EN" : "VI"}
            </button>
          </div>
        </header>

        {/* Breadcrumb Navigation */}
        <div className="border-b border-white/5 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-3.5 text-xs font-sans text-[#eaeaea]/60 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("home");
              }}
              className="hover:text-gold transition-colors cursor-pointer"
            >
              {lang === "vi" ? "Trang chủ" : "Home"}
            </button>
            <span className="text-[#eaeaea]/30">•</span>
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("products");
              }}
              className="hover:text-gold transition-colors cursor-pointer"
            >
              {lang === "vi" ? "Tất cả sản phẩm" : "All Products"}
            </button>
            <span className="text-[#eaeaea]/30">•</span>
            <span className="text-gold-accent font-medium">
              {meta.badge || (lang === "vi" ? "Đặc sản OCOP" : "OCOP Specialty")}
            </span>
            <span className="text-[#eaeaea]/30">•</span>
            <span className="text-white font-medium truncate max-w-[220px] sm:max-w-none">
              {localizedProduct?.name || activeDetailProduct.name}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-grow z-10 w-full">
          {/* IMAGE 1: PRODUCT SHOWCASE & BUY BOX */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
              {/* Left Column: Main Image + Thumbnails */}
              <div className="lg:col-span-6 space-y-4">
                {/* Main Large Image */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl bg-white/[0.02]">
                  <img
                    src={currentImg}
                    alt={activeDetailProduct.name}
                    className="w-full h-full object-cover transition-all duration-500"
                  />
                  {/* OCOP Star Badge */}
                  <div className="absolute top-4 left-4 bg-gold text-dark-bg font-mono font-bold text-xs tracking-wider uppercase px-3 py-1 rounded-full shadow-lg border border-gold-light/40">
                    {meta?.rating || "OCOP 4★"}
                  </div>
                </div>

                {/* Thumbnails Row */}
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {galleryImages.map((thumbUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDetailImage(thumbUrl)}
                      className={`relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden border transition-all duration-200 shrink-0 cursor-pointer ${
                        currentImg === thumbUrl
                          ? "border-gold ring-2 ring-gold/40 shadow-lg shadow-gold/10 scale-102"
                          : "border-white/10 opacity-70 hover:opacity-100 hover:border-white/30"
                      }`}
                    >
                      <img
                        src={thumbUrl}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Product Info & Purchase Options */}
              <div className="lg:col-span-6 space-y-6 text-left">
                {/* Brand line */}
                <div className="text-xs uppercase tracking-widest text-[#eaeaea]/60 font-sans">
                  {lang === "vi" ? "Thương hiệu " : "Brand "}
                  <span className="text-gold font-bold tracking-wider">Ocopia Heritage</span>
                </div>

                {/* Product Title */}
                <div className="space-y-2">
                  <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-white font-bold leading-tight tracking-wide">
                    {localizedProduct?.name || activeDetailProduct.name}
                  </h1>
                  <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/70 font-light leading-relaxed">
                    {productTagline}
                  </p>
                </div>

                {/* Badge Tag */}
                <div>
                  <span className="inline-block bg-gold text-dark-bg font-sans font-bold text-[11px] tracking-wider uppercase px-3 py-1 rounded-full shadow-sm">
                    {meta?.badge || (lang === "vi" ? "Đặc sản Quảng Nam" : "Quang Nam Specialty")}
                  </span>
                </div>

                {/* Mẫu & KLT */}
                <div className="space-y-2 pt-1 border-t border-white/5">
                  <span className="text-xs font-semibold text-[#eaeaea]/70 tracking-wider block font-sans">
                    {lang === "vi" ? "Mẫu & KLT" : "Packaging & Weight"}
                  </span>
                  <div className="inline-flex items-center px-4 py-1.5 rounded-lg border border-gold bg-gold/10 text-gold font-serif text-xs sm:text-sm font-semibold tracking-wide shadow-sm">
                    {meta?.packaging || (lang === "vi" ? "Hộp đặc sản" : "Specialty Box")}
                  </div>
                </div>

                {/* Price */}
                <div className="pt-1">
                  <span className="font-serif text-3xl sm:text-4xl font-bold text-gold">
                    {activeDetailProduct.price.toLocaleString("vi-VN")} VNĐ
                  </span>
                </div>

                {/* Quantity + Buy Button */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-[#eaeaea]/60 block font-light">
                    {lang === "vi" ? "Thêm số lượng" : "Select quantity"}
                  </span>
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Quantity counter */}
                    <div className="flex items-center border border-gold/40 hover:border-gold rounded-lg overflow-hidden glass-panel shadow-sm">
                      <button
                        type="button"
                        onClick={() => setDetailQuantity(Math.max(1, detailQuantity - 1))}
                        className="px-4 py-2.5 text-white hover:text-gold hover:bg-gold/15 text-lg font-bold transition-colors cursor-pointer select-none"
                        aria-label="Giảm số lượng"
                      >
                        -
                      </button>
                      <span className="px-4 py-2.5 font-mono text-base font-bold text-white min-w-[3rem] text-center select-none">
                        {detailQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDetailQuantity(detailQuantity + 1)}
                        className="px-4 py-2.5 text-white hover:text-gold hover:bg-gold/15 text-lg font-bold transition-colors cursor-pointer select-none"
                        aria-label="Tăng số lượng"
                      >
                        +
                      </button>
                    </div>

                    {/* Action Buttons: Thêm vào giỏ hàng & Mua ngay */}
                    <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                      {/* Button 1: Thêm vào giỏ hàng */}
                      <button
                        type="button"
                        onClick={() => handleAddToCart(activeDetailProduct, detailQuantity)}
                        className="flex-1 font-serif text-xs sm:text-sm tracking-wider border-2 border-gold/70 hover:border-gold text-gold hover:bg-gold/10 font-bold py-3.5 px-4 rounded-lg uppercase shadow-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer select-none"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <span>{t.addToCartBtn || (lang === "vi" ? "Thêm vào giỏ hàng" : "Add to Cart")}</span>
                      </button>

                      {/* Button 2: Mua ngay */}
                      <button
                        type="button"
                        onClick={() => openCheckout(activeDetailProduct, detailQuantity)}
                        className="flex-1 font-serif text-xs sm:text-sm tracking-wider bg-gold hover:bg-gold-light text-dark-bg font-bold py-3.5 px-6 rounded-lg uppercase shadow-xl shadow-gold/15 transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex items-center justify-center select-none"
                      >
                        {t.buyNowBtn || (lang === "vi" ? "Mua ngay" : "Buy Now")}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4 Trust & Policy Cards (2x2 grid matching Image 1) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl glass-panel border border-white/5 bg-white/[0.02]">
                    <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4m-12-6h13l3 4v5H4v-9zM4 11V6a2 2 0 012-2h8a2 2 0 012 2v5" />
                      </svg>
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-xs font-semibold text-white">
                        {lang === "vi" ? "Miễn phí vận chuyển" : "Free shipping"}
                      </p>
                      <p className="text-[11px] text-[#eaeaea]/60 font-light">
                        {lang === "vi" ? "Đơn hàng từ 200.000đ" : "Orders from 200k"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl glass-panel border border-white/5 bg-white/[0.02]">
                    <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-xs font-semibold text-white">
                        {lang === "vi" ? "Giao hàng nhanh" : "Fast delivery"}
                      </p>
                      <p className="text-[11px] text-[#eaeaea]/60 font-light">
                        {lang === "vi" ? "Toàn quốc 2 - 3 ngày" : "Nationwide 2-3 days"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl glass-panel border border-white/5 bg-white/[0.02]">
                    <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-xs font-semibold text-white">
                        {lang === "vi" ? "Mua nhanh tiện lợi" : "Quick checkout"}
                      </p>
                      <p className="text-[11px] text-[#eaeaea]/60 font-light">
                        {lang === "vi" ? "Chỉ cần số điện thoại" : "With phone number only"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl glass-panel border border-white/5 bg-white/[0.02]">
                    <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-xs font-semibold text-white">
                        {lang === "vi" ? "Bản sắc OCOP" : "OCOP Heritage"}
                      </p>
                      <p className="text-[11px] text-[#eaeaea]/60 font-light">
                        {lang === "vi" ? "100% nông sản bản địa" : "100% local ingredients"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: THÔNG TIN SẢN PHẨM */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-10 md:py-12 border-t border-white/10 text-left">
            <div className="space-y-4 max-w-4xl">
              <h3 className="font-serif text-xl sm:text-2xl text-white font-bold tracking-wide">
                {lang === "vi" ? "Thông tin sản phẩm" : "Product Information"}
              </h3>
              <ul className="space-y-2.5 font-sans text-xs sm:text-sm text-[#eaeaea]/85 font-light list-disc pl-5 leading-relaxed">
                {specs.map((item, idx) => (
                  <li key={idx} className="pl-1">
                    <span className="text-white font-medium">{item.label}: </span>
                    <span className="text-[#eaeaea]/85">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* MIDDLE SECTION: 4:3 LIFESTYLE PHOTO + PRODUCT STORY + CTA BUTTON */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-10 md:py-14 border-t border-white/10">
            <div className="max-w-3xl mx-auto space-y-8">
              {/* Centered 4:3 Lifestyle Image */}
              {meta?.lifestyleImage && (
                <div className="relative aspect-[4/3] w-full max-w-2xl sm:max-w-3xl mx-auto rounded-2xl overflow-hidden glass-panel border border-gold/30 shadow-2xl bg-white/[0.02]">
                  <img
                    src={meta.lifestyleImage}
                    alt={localizedProduct?.name || activeDetailProduct.name}
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.02]"
                  />
                </div>
              )}

              {/* Product Story Text from Content SP.txt */}
              <div className="space-y-4 text-left font-sans text-xs sm:text-sm md:text-base text-[#eaeaea]/90 leading-relaxed px-2 sm:px-4">
                {productStoryParagraphs.map((paragraph, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Centered "ĐẶT MUA NGAY" CTA button */}
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => openCheckout(activeDetailProduct, detailQuantity)}
                  className="font-serif text-xs sm:text-sm tracking-widest uppercase bg-gold hover:bg-gold-light text-dark-bg font-bold py-3.5 px-10 rounded-lg shadow-xl shadow-gold/20 transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center select-none"
                >
                  {lang === "vi" ? "ĐẶT MUA NGAY" : "ORDER NOW"}
                </button>
              </div>
            </div>
          </section>

          {/* IMAGE 3: SẢN PHẨM BẠN CÓ THỂ THÍCH */}
          {relatedProducts.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12 md:py-16 border-t border-white/10 text-left space-y-8">
              <div className="space-y-1">
                <h3 className="font-serif text-2xl sm:text-3xl text-white font-bold tracking-wide">
                  {lang === "vi" ? "Sản phẩm bạn có thể thích" : "You May Also Like"}
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                {relatedProducts.map((relProduct) => {
                  const localizedRel = t.products?.[String(relProduct.id)];
                  return (
                    <div
                      key={relProduct.id}
                      onClick={() => handleOpenDetail(relProduct)}
                      className="group flex flex-col text-left cursor-pointer transition-all duration-300"
                    >
                      {/* Product Image */}
                      <div className="relative aspect-square w-full rounded-2xl overflow-hidden glass-panel border border-white/10 group-hover:border-gold/50 transition-all duration-300 shadow-md group-hover:shadow-2xl group-hover:shadow-gold/5">
                        <img
                          src={relProduct.image_url}
                          alt={relProduct.name}
                          className="w-full h-full object-cover transform group-hover:scale-106 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3 bg-gold text-dark-bg font-mono font-bold text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-md border border-gold-light/40">
                          {PRODUCT_METADATA[relProduct.id]?.rating || "OCOP 4★"}
                        </div>
                        <div className="absolute inset-0 bg-dark-bg/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3">
                          <span className="font-serif text-xs font-bold tracking-widest text-dark-bg bg-gold px-4 py-2 rounded-full uppercase shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            {t.viewMore || "XEM CHI TIẾT"} →
                          </span>
                        </div>
                      </div>

                      {/* Product Info below image */}
                      <div className="pt-3 space-y-1">
                        <h4 className="font-serif text-base sm:text-lg font-medium text-white group-hover:text-gold transition-colors line-clamp-2 leading-snug">
                          {localizedRel?.name || relProduct.name}
                        </h4>
                        <p className="font-sans text-xs text-[#eaeaea]/50 font-light line-clamp-1">
                          {PRODUCT_METADATA[relProduct.id]?.packaging || (lang === "vi" ? "Hộp đặc sản" : "Specialty Box")}
                        </p>
                        <p className="font-serif text-base sm:text-lg font-bold text-gold pt-0.5">
                          {relProduct.price.toLocaleString("vi-VN")} VNĐ
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        {/* Checkout Modal */}
        {renderCheckoutModal()}

        {/* PayOS Redirect Status Modal */}
        {renderRedirectStatusModal()}

        {/* Footer */}
        <footer id="about" className="border-t border-white/5 py-10 px-6 md:px-12 bg-dark-bg/60 text-center">
          <div className="max-w-2xl mx-auto space-y-2">
            <span className="font-serif text-xl tracking-[0.2em] gold-gradient-text uppercase font-bold block">
              OCOPIA HERITAGE
            </span>
            <p className="font-mono text-xs sm:text-sm text-gold-accent tracking-widest">
              {lang === "vi" ? "Liên hệ" : "Hotline"}: 0787755835
            </p>
          </div>
        </footer>

        {/* Toast Notification */}
        {cartToast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl glass-panel border border-gold/50 bg-[#14151a]/95 text-white shadow-2xl animate-fade-in-up">
            <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-sans text-xs sm:text-sm font-medium">{cartToast}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden font-sans">
      {/* Background Decorative Blur Lines */}
      <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[30%] right-[-10%] w-[600px] h-[600px] bg-gold-accent/5 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Top Announcement Bar */}
      <aside className="w-full bg-[#18140c] text-gold-light/95 border-b border-gold/20 py-2 px-4 text-xs font-sans tracking-wide">
        <div className="max-w-7xl mx-auto text-center font-medium truncate">
          <span>{t.topBarText || "SIÊU ƯU ĐÃI NÔNG SẢN VIỆT - MIỄN PHÍ VẬN CHUYỂN TOÀN QUỐC CHO ĐƠN TỪ 200.000Đ"}</span>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5 py-3.5 px-4 md:px-12 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <div
          onClick={() => navigateTo("home")}
          className="flex items-center gap-3 group shrink-0 cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-gold/40 shadow-sm p-0.5 bg-dark-bg/60 group-hover:border-gold transition-colors">
            <img
              src="/background.jpg"
              alt="Ocopia Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-[0.2em] gold-gradient-text uppercase leading-none">
                Ocopia
              </span>
              <span className="text-[9px] uppercase font-mono tracking-widest bg-gold/10 text-gold-accent border border-gold/20 px-1.5 py-0.5 rounded hidden sm:inline-block">
                Heritage
              </span>
            </div>
            <span className="text-[9px] font-sans text-[#eaeaea]/50 tracking-wider hidden md:block">
              {lang === "vi" ? "Đặc sản OCOP Việt Nam" : "Vietnamese OCOP Heritage"}
            </span>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 font-serif text-xs tracking-[0.18em] uppercase">
          <button
            onClick={() => navigateTo("products")}
            className={`transition-all duration-300 font-medium cursor-pointer py-1 ${
              currentView === "products"
                ? "text-gold font-bold border-b-2 border-gold"
                : "text-[#eaeaea]/85 hover:text-gold"
            }`}
          >
            {t.navProducts || "SẢN PHẨM"}
          </button>
          <button
            onClick={() => {
              if (currentView !== "home") {
                navigateTo("home");
                setTimeout(() => {
                  const el = document.getElementById("about");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }, 100);
              } else {
                const el = document.getElementById("about");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="text-[#eaeaea]/85 hover:text-gold transition-colors font-medium cursor-pointer py-1"
          >
            {t.navStory || "CÂU CHUYỆN"}
          </button>
        </nav>

        {/* Right: Actions (Cart, Theme & Lang) */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Cart Icon with Counter Badge */}
          <button
            onClick={() => navigateTo("cart")}
            className="relative p-2 text-gold hover:text-gold-light transition-colors rounded-full hover:bg-gold/5 cursor-pointer"
            aria-label="Shopping Cart"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="absolute top-0.5 right-0.5 bg-gold text-dark-bg text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center font-mono shadow-sm">
              {totalCartCount}
            </span>
          </button>

          <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="text-gold hover:text-gold-light transition-colors p-1"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="font-serif text-[11px] font-bold tracking-widest text-[#eaeaea]/85 hover:text-gold transition-colors border border-white/10 hover:border-gold/50 rounded px-2 py-0.5"
            aria-label="Toggle language"
          >
            {lang === "vi" ? "EN" : "VI"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow z-10 w-full">
        {currentView === "cart" ? (
          /* CART PAGE VIEW (Shopee Style with Ocopia Heritage Elegance) */
          <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-10 md:py-14 space-y-8 w-full flex-grow text-left">
            {/* Breadcrumb Navigation */}
            <div className="text-xs font-sans text-[#eaeaea]/60 flex items-center gap-2">
              <button
                onClick={() => navigateTo("home")}
                className="hover:text-gold transition-colors cursor-pointer"
              >
                {lang === "vi" ? "Trang chủ" : "Home"}
              </button>
              <span className="text-[#eaeaea]/30">•</span>
              <span className="text-white font-medium">
                {t.cartTitle || (lang === "vi" ? "Giỏ hàng của bạn" : "Your Shopping Cart")}
              </span>
            </div>

            {/* Header info: Title + Count */}
            <div className="border-b border-white/10 pb-6 flex items-baseline justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-light tracking-wide">
                  {t.cartTitle || (lang === "vi" ? "Giỏ hàng của bạn" : "Your Shopping Cart")}
                </h1>
                <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/60 font-light">
                  {lang === "vi"
                    ? `(Tổng ${cart.length} món trong giỏ hàng)`
                    : `(${cart.length} items in your cart)`}
                </p>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigateTo("products")}
                  className="font-serif text-xs tracking-wider text-gold hover:text-gold-light border border-gold/30 hover:border-gold px-4 py-2 rounded-md transition-colors cursor-pointer uppercase"
                >
                  + {lang === "vi" ? "Chọn thêm sản phẩm khác" : "Add more products"}
                </button>
              )}
            </div>

            {/* Cart Body */}
            {cart.length === 0 ? (
              /* Empty Cart State */
              <div className="text-center py-20 px-4 space-y-6 glass-panel rounded-2xl border border-white/10 max-w-lg mx-auto bg-white/[0.01]">
                <div className="w-20 h-20 bg-gold/10 border border-gold/30 rounded-full flex items-center justify-center mx-auto text-gold">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-2xl text-white">
                    {t.cartEmptyTitle || (lang === "vi" ? "Giỏ hàng của bạn đang trống" : "Your cart is currently empty")}
                  </h3>
                  <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/60 max-w-sm mx-auto leading-relaxed">
                    {t.cartEmptyDesc || (lang === "vi" ? "Hãy dạo quanh cửa hàng để khám phá những đặc sản OCOP truyền thống thơm thảo." : "Explore our authentic Vietnamese OCOP heritage specialties.")}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigateTo("products")}
                    className="font-serif text-xs sm:text-sm tracking-widest bg-gold hover:bg-gold-light text-dark-bg font-bold py-3.5 px-8 rounded-lg uppercase shadow-lg shadow-gold/10 transition-all cursor-pointer"
                  >
                    {t.continueShopping || (lang === "vi" ? "MUA SẮM NGAY" : "SHOP NOW")}
                  </button>
                </div>
              </div>
            ) : (
              /* Cart Items List + Shopee Style Checkout Bar */
              <div className="space-y-6">
                {/* Table Header (Desktop) */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 rounded-xl glass-panel border border-white/10 text-xs font-sans font-medium text-[#eaeaea]/70 items-center bg-white/[0.02]">
                  <div className="col-span-5 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="select-all-top"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gold/50 text-gold focus:ring-gold accent-amber-500 cursor-pointer"
                    />
                    <label htmlFor="select-all-top" className="cursor-pointer select-none">
                      {t.selectAll || (lang === "vi" ? "Chọn tất cả" : "Select All")} ({cart.length})
                    </label>
                  </div>
                  <div className="col-span-2 text-center">{t.unitPriceLabel || (lang === "vi" ? "Đơn giá" : "Unit Price")}</div>
                  <div className="col-span-2 text-center">{t.quantity || (lang === "vi" ? "Số lượng" : "Quantity")}</div>
                  <div className="col-span-2 text-right">{t.subtotalLabel || (lang === "vi" ? "Số tiền" : "Subtotal")}</div>
                  <div className="col-span-1 text-center">{t.actionLabel || (lang === "vi" ? "Thao tác" : "Action")}</div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  {cart.map((item) => {
                    const localized = t.products?.[String(item.product.id)];
                    const itemMeta = PRODUCT_METADATA[item.product.id];
                    const itemSpec = itemMeta?.packaging || (lang === "vi" ? "Hộp đặc sản" : "Specialty Box");

                    return (
                      <div
                        key={item.product.id}
                        className={`p-4 sm:p-5 rounded-xl glass-panel border transition-all duration-300 ${
                          item.selected
                            ? "border-gold/40 bg-gold/[0.03]"
                            : "border-white/10 bg-white/[0.01]"
                        }`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          {/* Checkbox + Product Info */}
                          <div className="col-span-1 md:col-span-5 flex items-center gap-3 sm:gap-4">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleSelectItem(item.product.id)}
                              className="w-5 h-5 rounded border-gold/50 text-gold focus:ring-gold accent-amber-500 cursor-pointer shrink-0"
                            />
                            {/* Product thumbnail */}
                            <div
                              onClick={() => handleOpenDetail(item.product)}
                              className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden glass-panel border border-white/10 shrink-0 cursor-pointer hover:border-gold/50 transition-colors"
                            >
                              <img
                                src={item.product.image_url}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1 left-1 bg-gold text-dark-bg font-mono font-bold text-[8px] uppercase px-1.5 py-0.2 rounded shadow-sm">
                                {itemMeta?.rating ? `${itemMeta.rating}★` : "4★"}
                              </div>
                            </div>
                            {/* Title & specs */}
                            <div className="min-w-0 flex-1">
                              <h3
                                onClick={() => handleOpenDetail(item.product)}
                                className="font-serif text-sm sm:text-base font-semibold text-white hover:text-gold transition-colors cursor-pointer truncate"
                              >
                                {localized?.name || item.product.name}
                              </h3>
                              <p className="font-sans text-xs text-[#eaeaea]/50 mt-0.5">
                                {itemSpec}
                              </p>
                              {/* Mobile price indicator */}
                              <div className="md:hidden pt-1 font-serif text-sm font-bold text-gold">
                                {item.product.price.toLocaleString("vi-VN")} VNĐ
                              </div>
                            </div>
                          </div>

                          {/* Unit Price (Desktop) */}
                          <div className="hidden md:block col-span-2 text-center font-serif text-sm text-[#eaeaea]/90">
                            {item.product.price.toLocaleString("vi-VN")} VNĐ
                          </div>

                          {/* Quantity Counter */}
                          <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center gap-2">
                            <span className="md:hidden text-xs text-[#eaeaea]/60">{t.quantity}:</span>
                            <div className="flex items-center border border-gold/40 rounded-lg overflow-hidden glass-panel shadow-sm">
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.product.id, item.quantity - 1)}
                                className="px-3 py-1.5 text-white hover:text-gold hover:bg-gold/15 text-base font-bold transition-colors cursor-pointer select-none"
                              >
                                -
                              </button>
                              <span className="px-3 py-1.5 font-mono text-sm font-bold text-white min-w-[2.2rem] text-center select-none">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
                                className="px-3 py-1.5 text-white hover:text-gold hover:bg-gold/15 text-base font-bold transition-colors cursor-pointer select-none"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Line Total */}
                          <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-end">
                            <span className="md:hidden text-xs text-[#eaeaea]/60">{t.subtotalLabel || "Số tiền"}:</span>
                            <span className="font-serif text-base sm:text-lg font-bold text-gold">
                              {(item.product.price * item.quantity).toLocaleString("vi-VN")} VNĐ
                            </span>
                          </div>

                          {/* Action (Delete) */}
                          <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.product.id)}
                              className="text-white/40 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                              title={lang === "vi" ? "Xóa món này" : "Remove item"}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SHOPEE STYLE STICKY / BOTTOM CHECKOUT BAR */}
                <div className="sticky bottom-4 z-30 p-4 sm:p-5 rounded-2xl glass-panel border border-gold/40 shadow-2xl bg-dark-bg/95 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Left: Select all & Batch remove */}
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                    <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-5 h-5 rounded border-gold/50 text-gold focus:ring-gold accent-amber-500 cursor-pointer"
                      />
                      <span>
                        {t.selectAll || (lang === "vi" ? "Chọn tất cả" : "Select All")} ({cart.length})
                      </span>
                    </label>

                    {selectedCartItems.length > 0 && (
                      <button
                        type="button"
                        onClick={removeSelectedItems}
                        className="text-xs text-red-400/80 hover:text-red-400 transition-colors cursor-pointer underline"
                      >
                        {t.deleteSelected || (lang === "vi" ? "Xóa đã chọn" : "Delete Selected")} ({selectedCartItems.length})
                      </button>
                    )}
                  </div>

                  {/* Right: Total payment & Checkout Button */}
                  <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="text-[11px] sm:text-xs text-[#eaeaea]/60 block font-light">
                        {t.totalPaymentLabel || (lang === "vi" ? "Tổng thanh toán" : "Total Payment")} ({selectedTotalCount} {lang === "vi" ? "sản phẩm" : "items"}):
                      </span>
                      <span className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-gold">
                        {selectedTotalAmount.toLocaleString("vi-VN")} VNĐ
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={openCartCheckout}
                      disabled={selectedCartItems.length === 0}
                      className={`font-serif text-xs sm:text-sm md:text-base tracking-wider font-bold py-3.5 px-8 rounded-lg uppercase shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer whitespace-nowrap ${
                        selectedCartItems.length > 0
                          ? "bg-gold hover:bg-gold-light text-dark-bg shadow-gold/20"
                          : "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
                      }`}
                    >
                      {t.checkoutBtn || (lang === "vi" ? "MUA HÀNG" : "CHECKOUT")} ({selectedTotalCount})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : currentView === "products" ? (
          /* ALL PRODUCTS PAGE VIEW (Styled like Langfarm Image 2 with Ocopia aesthetic) */
          <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-10 md:py-14 space-y-8 w-full flex-grow text-left">
            {/* Header info: Title + Total products count */}
            <div className="border-b border-white/10 pb-6 space-y-1.5">
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-light tracking-wide">
                {t.allProductsHeading || "Tất cả sản phẩm"}
              </h1>
              <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/60 font-light">
                {lang === "vi" 
                  ? `Tổng ${products.length} sản phẩm` 
                  : `Total ${products.length} products`}
              </p>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="flex justify-center items-center py-24">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold"></div>
              </div>
            ) : error ? (
              <div className="text-center py-20 text-red-400 font-sans glass-panel p-6 rounded-md max-w-md mx-auto">
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                {products.map((product) => {
                  const localizedProduct = t.products?.[String(product.id)];
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleOpenDetail(product)}
                      className="group flex flex-col text-left cursor-pointer transition-all duration-300"
                    >
                      {/* Product Image Box */}
                      <div className="relative aspect-square w-full rounded-2xl overflow-hidden glass-panel border border-white/10 group-hover:border-gold/50 transition-all duration-300 shadow-md group-hover:shadow-2xl group-hover:shadow-gold/5">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover transform group-hover:scale-106 transition-transform duration-500"
                        />
                        {/* Rating / Best-seller Pill Badge */}
                        <div className="absolute top-3 left-3 bg-gold text-dark-bg font-mono font-bold text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-md border border-gold-light/40">
                          {PRODUCT_METADATA[product.id]?.rating || "OCOP 4★"}
                        </div>

                        {/* Quick View Hover overlay */}
                        <div className="absolute inset-0 bg-dark-bg/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3">
                          <span className="font-serif text-xs font-bold tracking-widest text-dark-bg bg-gold px-4 py-2 rounded-full uppercase shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            {t.viewMore || "XEM CHI TIẾT"} →
                          </span>
                        </div>
                      </div>

                      {/* Product Info below image */}
                      <div className="pt-3 space-y-1">
                        <h3 className="font-serif text-base sm:text-lg font-medium text-white group-hover:text-gold transition-colors line-clamp-2 leading-snug">
                          {localizedProduct?.name || product.name}
                        </h3>
                        <p className="font-sans text-xs text-[#eaeaea]/50 font-light line-clamp-1">
                          {PRODUCT_METADATA[product.id]?.packaging || (lang === "vi" ? "Hộp đặc sản" : "Specialty Box")}
                        </p>
                        <p className="font-serif text-base sm:text-lg font-bold text-gold pt-0.5">
                          {product.price.toLocaleString("vi-VN")} VNĐ
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          /* HOME VIEW */
          <>
            {/* Hero Banner Image */}
            <section className="relative px-4 sm:px-6 md:px-12 lg:px-16 pt-6 pb-6 max-w-7xl mx-auto w-full">
              <div className="relative rounded-2xl md:rounded-3xl overflow-hidden glass-panel border border-gold/25 shadow-2xl transition-all duration-500">
                <img
                  src="/homepage-banner.png"
                  alt="Hương quê hội tụ - Đặc sản trao tay"
                  className="w-full h-auto object-cover block"
                />
              </div>
            </section>

            {/* Product Showroom Stage */}
            <section id="showroom" className="max-w-4xl mx-auto px-6 py-24 space-y-36">
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{t.catalogLabel}</span>
                <h2 className="font-serif text-3xl md:text-5xl font-light text-white uppercase tracking-wider">
                  {t.catalogTitle}
                </h2>
                <div className="w-16 h-[1px] bg-gold/40 mx-auto"></div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold"></div>
                </div>
              ) : error ? (
                <div className="text-center py-20 text-red-400 font-sans glass-panel p-6 rounded-md max-w-md mx-auto">
                  {error}
                </div>
              ) : (
                <div className="space-y-32">
                  {products
                    .filter((p) => [1, 3, 7].includes(p.id))
                    .map((product) => (
                    <div
                      key={product.id}
                      className="flex flex-col items-center text-center space-y-8"
                    >
                      {/* Center aligned package image */}
                      <div className="w-full max-w-md relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-gold/20 to-gold-accent/5 rounded-lg blur opacity-20 group-hover:opacity-35 transition duration-1000"></div>
                        <div className="relative aspect-[3/4] rounded-lg overflow-hidden glass-panel border border-white/10 shadow-2xl">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover transform group-hover:scale-103 transition-transform duration-700"
                          />
                        </div>
                      </div>

                      {/* Product title and Xem thêm button */}
                      <div className="space-y-4">
                        <h3 className="font-serif text-3xl md:text-4xl text-white font-light uppercase tracking-widest">
                          {t.products[String(product.id)]?.name || product.name}
                        </h3>
                        <div className="w-12 h-[1px] bg-gold/30 mx-auto"></div>
                        <button
                          onClick={() => handleOpenDetail(product)}
                          className="font-serif text-xs tracking-[0.2em] border border-gold/40 text-gold hover:bg-gold hover:text-dark-bg transition-all duration-300 font-semibold py-3.5 px-10 rounded-sm uppercase cursor-pointer"
                        >
                          {t.viewMore}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Checkout Modal */}
      {renderCheckoutModal()}

      {/* PayOS Redirect Status Modal */}
      {renderRedirectStatusModal()}

      {/* Footer */}
      <footer id="about" className="border-t border-white/5 py-10 px-6 md:px-12 bg-dark-bg/60 text-center">
        <div className="max-w-2xl mx-auto space-y-2">
          <span className="font-serif text-xl tracking-[0.2em] gold-gradient-text uppercase font-bold block">
            OCOPIA HERITAGE
          </span>
          <p className="font-mono text-xs sm:text-sm text-gold-accent tracking-widest">
            {lang === "vi" ? "Liên hệ" : "Hotline"}: 0787755835
          </p>
        </div>
      </footer>
    </div>
  );
}