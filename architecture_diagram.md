```mermaid
classDiagram
    direction TB

    %% ════════════════════════════════════════════════════════════
    %% BACKEND CORE INFRASTRUCTURE
    %% ════════════════════════════════════════════════════════════

    class App {
        +createApp() Express
    }
    class ExpressRouter {
        +use(path, router)
        +get(path, handler)
    }
    class EnvConfig {
        +NODE_ENV
        +PORT
        +CORS_ORIGIN
        +DATABASE_URL
        +JWT_SECRET
        +STORAGE_PROVIDER
        +UPLOAD_DIR
    }
    class DatabasePool {
        +pool Pool
        +query(text, params) Promise
        +connectAndVerify() Promise
    }
    class ApiResponse {
        +ok(res, data, message, status)
        +fail(res, message, status, details)
    }
    class ErrorHandler {
        +notFoundHandler(req, res)
        +errorHandler(err, req, res)
    }

    App *-- ExpressRouter
    App ..> EnvConfig
    App ..> ErrorHandler
    ErrorHandler ..> ApiResponse

    %% ════════════════════════════════════════════════════════════
    %% AUTH MIDDLEWARE
    %% ════════════════════════════════════════════════════════════

    class RequireAuth {
        +requireAuth(req, res, next)
        +requireRole(...roles) Middleware
    }
    RequireAuth ..> ApiResponse
    RequireAuth ..> AuthService

    %% ════════════════════════════════════════════════════════════
    %% UPLOAD SYSTEM
    %% ════════════════════════════════════════════════════════════

    class UploadConfig {
        +ENTITY_CONFIGS
        +ALLOWED_MIMES
        +OUTPUT_FORMAT
    }
    class UploadMiddleware {
        +singleUpload(entityType, fieldName) Middleware[]
        +multiUpload(entityType, fieldName) Middleware[]
        -createMulter(entityType) Multer
        -processImage(buffer, entityType) Buffer
        -generateFilename(entityId) string
    }
    class Multer {
        +memoryStorage()
        +single(fieldName)
        +array(fieldName, maxCount)
    }
    class Sharp {
        +resize(options)
        +webp(options)
        +toBuffer() Buffer
    }
    class FileType {
        +fileTypeFromBuffer(buffer) Result
    }

    class StorageProvider {
        <<interface>>
        +save(buffer, entityType, filename) string
        +delete(relativePath) void
        +getUrl(relativePath) string
    }
    class LocalStorageProvider {
        -baseDir string
        +save(buffer, entityType, filename) string
        +delete(relativePath) void
        +getUrl(relativePath) string
    }
    class CloudStorageProvider {
        <<future>>
    }

    StorageProvider <|.. LocalStorageProvider
    StorageProvider <|.. CloudStorageProvider
    UploadMiddleware ..> Multer
    UploadMiddleware ..> Sharp
    UploadMiddleware ..> FileType
    UploadMiddleware ..> UploadConfig
    UploadMiddleware ..> LocalStorageProvider

    %% ════════════════════════════════════════════════════════════
    %% BACKEND MODULES
    %% ════════════════════════════════════════════════════════════

    class AuthRoutes { +router }
    class AuthController {
        +register(req, res)
        +login(req, res)
        +me(req, res)
    }
    class AuthService {
        +registerUser(data) User
        +loginUser(email, password) token+user
        +verifyToken(token) payload
        +findUserById(id) User
    }
    class AuthSchema {
        +registerSchema
        +loginSchema
    }

    AuthRoutes --> AuthController
    AuthController --> AuthService
    AuthController ..> AuthSchema
    AuthService ..> DatabasePool
    ExpressRouter *-- AuthRoutes

    class UsersRoutes { +router }
    class UsersController {
        +listUsers(req, res)
        +getUserById(req, res)
        +updateUser(req, res)
        +updateAvatar(req, res)
        +deleteUser(req, res)
    }
    class UsersService {
        +list(filters) Users[]
        +findById(id) User
        +update(id, data) User
        +updateAvatar(id, path) User
        +softDelete(id) void
    }
    class UsersSchema {
        +updateUserSchema
        +listUsersSchema
    }

    UsersRoutes --> UsersController
    UsersController --> UsersService
    UsersController ..> UsersSchema
    UsersService ..> DatabasePool
    UsersRoutes ..> RequireAuth
    UsersRoutes ..> UploadMiddleware
    ExpressRouter *-- UsersRoutes

    class TechniciansRoutes { +router }
    class TechniciansController {
        +list(req, res)
        +getById(req, res)
        +createProfile(req, res)
        +updateProfile(req, res)
        +uploadGallery(req, res)
        +deleteGalleryImage(req, res)
    }
    class TechniciansService {
        +list(filters) Technicians[]
        +findById(id) Technician
        +createProfile(userId, data) Profile
        +updateProfile(id, data) Profile
        +addGalleryImages(id, files) Images[]
        +removeGalleryImage(id, imageId) void
    }
    class TechniciansSchema {
        +createProfileSchema
        +updateProfileSchema
        +listQuerySchema
    }

    TechniciansRoutes --> TechniciansController
    TechniciansController --> TechniciansService
    TechniciansController ..> TechniciansSchema
    TechniciansService ..> DatabasePool
    TechniciansService ..> LocalStorageProvider
    TechniciansRoutes ..> RequireAuth
    TechniciansRoutes ..> UploadMiddleware
    ExpressRouter *-- TechniciansRoutes

    class BookingsRoutes { +router }
    class BookingsController {
        +create(req, res)
        +list(req, res)
        +getById(req, res)
        +updateStatus(req, res)
    }
    class BookingsService {
        +create(data) Booking
        +list(filters) Bookings[]
        +findById(id) Booking
        +updateStatus(id, status, userId) Booking
    }
    class BookingsSchema {
        +createBookingSchema
        +updateStatusSchema
        +listQuerySchema
    }

    BookingsRoutes --> BookingsController
    BookingsController --> BookingsService
    BookingsController ..> BookingsSchema
    BookingsService ..> DatabasePool
    BookingsRoutes ..> RequireAuth
    ExpressRouter *-- BookingsRoutes

    class MarketplaceRoutes { +router }
    class MarketplaceController {
        +listProducts(req, res)
        +getProduct(req, res)
        +createProduct(req, res)
        +updateProduct(req, res)
        +createOrder(req, res)
        +listOrders(req, res)
        +getOrder(req, res)
    }
    class MarketplaceService {
        +listProducts(filters) Products[]
        +findProductById(id) Product
        +createProduct(data) Product
        +updateProduct(id, data) Product
        +createOrder(userId, data) Order
        +listOrders(filters) Orders[]
        +findOrderById(id) Order
    }
    class MarketplaceSchema {
        +createProductSchema
        +updateProductSchema
        +createOrderSchema
    }

    MarketplaceRoutes --> MarketplaceController
    MarketplaceController --> MarketplaceService
    MarketplaceController ..> MarketplaceSchema
    MarketplaceService ..> DatabasePool
    MarketplaceRoutes ..> RequireAuth
    MarketplaceRoutes ..> UploadMiddleware
    ExpressRouter *-- MarketplaceRoutes

    class ReviewsRoutes { +router }
    class ReviewsController {
        +create(req, res)
        +list(req, res)
        +getByBooking(req, res)
        +moderate(req, res)
    }
    class ReviewsService {
        +create(data) Review
        +listByTechnician(techId) Reviews[]
        +findByBooking(bookingId) Review
        +toggleVisibility(id) Review
    }
    class ReviewsSchema {
        +createReviewSchema
        +listQuerySchema
    }

    ReviewsRoutes --> ReviewsController
    ReviewsController --> ReviewsService
    ReviewsController ..> ReviewsSchema
    ReviewsService ..> DatabasePool
    ReviewsRoutes ..> RequireAuth
    ExpressRouter *-- ReviewsRoutes

    class WalletRoutes { +router }
    class WalletController {
        +getWallet(req, res)
        +topUp(req, res)
        +adminAdjust(req, res)
        +listTransactions(req, res)
        +adminListAll(req, res)
    }
    class WalletService {
        +getOrCreateWallet(userId) Wallet
        +topUp(userId, amount) Transaction
        +adminAdjust(walletId, data) Transaction
        +listTransactions(walletId, filters) Transactions[]
        +listAllWallets(filters) Wallets[]
    }
    class WalletSchema {
        +topUpSchema
        +adminAdjustSchema
    }

    WalletRoutes --> WalletController
    WalletController --> WalletService
    WalletController ..> WalletSchema
    WalletService ..> DatabasePool
    WalletRoutes ..> RequireAuth
    ExpressRouter *-- WalletRoutes

    class PromoRoutes { +router }
    class PromoController {
        +create(req, res)
        +list(req, res)
        +validate(req, res)
        +toggle(req, res)
    }
    class PromoService {
        +create(data) PromoCode
        +list(filters) PromoCodes[]
        +validate(code, userId, context) PromoCode
        +toggleActive(id) PromoCode
    }
    class PromoSchema {
        +createPromoSchema
        +validatePromoSchema
    }

    PromoRoutes --> PromoController
    PromoController --> PromoService
    PromoController ..> PromoSchema
    PromoService ..> DatabasePool
    PromoRoutes ..> RequireAuth
    ExpressRouter *-- PromoRoutes

    class SupportRoutes { +router }
    class SupportController {
        +createTicket(req, res)
        +listTickets(req, res)
        +updateTicket(req, res)
        +listNotifications(req, res)
        +markRead(req, res)
    }
    class SupportService {
        +createTicket(data) Dispute
        +listTickets(filters) Disputes[]
        +updateTicket(id, data) Dispute
        +listNotifications(userId) Notifications[]
        +markAsRead(id) Notification
    }
    class SupportSchema {
        +createTicketSchema
        +updateTicketSchema
    }

    SupportRoutes --> SupportController
    SupportController --> SupportService
    SupportController ..> SupportSchema
    SupportService ..> DatabasePool
    SupportRoutes ..> RequireAuth
    ExpressRouter *-- SupportRoutes

    %% ════════════════════════════════════════════════════════════
    %% DATABASE ENTITIES
    %% ════════════════════════════════════════════════════════════

    class User {
        +UUID id
        +string email
        +string password_hash
        +string full_name
        +string phone
        +string role
        +string avatar_url
        +numeric latitude
        +numeric longitude
        +bool is_active
        +timestamp deleted_at
    }
    class ServiceCategory {
        +UUID id
        +UUID parent_id
        +string name
        +string slug
        +string description
        +string icon_url
        +bool is_active
    }
    class TechnicianProfile {
        +UUID id
        +UUID user_id
        +string bio
        +int experience_years
        +numeric hourly_rate
        +numeric inspection_fee
        +bool is_verified
        +bool is_available
        +numeric rating_avg
        +int rating_count
    }
    class TechnicianGallery {
        +UUID id
        +UUID technician_id
        +string image_url
        +string caption
        +int display_order
    }
    class TechnicianSpecialization {
        +UUID id
        +UUID technician_id
        +UUID category_id
    }
    class TechnicianWorkDay {
        +UUID id
        +UUID technician_id
        +int day_of_week
        +bool is_active
    }
    class TimeSlot {
        +UUID id
        +UUID technician_id
        +UUID work_day_id
        +time start_time
        +time end_time
        +int max_bookings
    }
    class Booking {
        +UUID id
        +UUID client_id
        +UUID technician_id
        +UUID category_id
        +UUID slot_id
        +date booking_date
        +string service_title
        +string status
        +numeric agreed_price
    }
    class BookingStatusHistory {
        +UUID id
        +UUID booking_id
        +string old_status
        +string new_status
        +UUID changed_by
    }
    class Review {
        +UUID id
        +UUID booking_id
        +UUID client_id
        +UUID technician_id
        +int rating
        +string comment
        +bool is_visible
    }
    class Product {
        +UUID id
        +string name
        +string description
        +numeric price
        +int stock_qty
        +UUID category_id
        +string image_url
        +bool is_active
    }
    class Order {
        +UUID id
        +UUID user_id
        +numeric subtotal
        +numeric discount_amount
        +numeric total
        +string shipping_address
        +string status
    }
    class OrderItem {
        +UUID id
        +UUID order_id
        +UUID product_id
        +int quantity
        +numeric unit_price
    }
    class CartItem {
        +UUID id
        +UUID user_id
        +UUID product_id
        +int quantity
    }
    class Payment {
        +UUID id
        +UUID order_id
        +UUID booking_id
        +UUID user_id
        +numeric amount
        +string method
        +string status
        +string payment_type
    }
    class WalletAccount {
        +UUID id
        +UUID user_id
        +numeric current_balance
    }
    class WalletTransaction {
        +UUID id
        +UUID wallet_id
        +string type
        +numeric amount
        +string direction
        +string reference_type
        +UUID reference_id
    }
    class SavedPaymentMethod {
        +UUID id
        +UUID user_id
        +string provider
        +string card_brand
        +string last4
        +string token
        +bool is_default
    }
    class PromoCode {
        +UUID id
        +string code
        +string discount_type
        +numeric discount_value
        +int max_uses
        +int used_count
        +string applies_to
        +bool is_active
        +UUID created_by
    }
    class PromoRedemption {
        +UUID id
        +UUID promo_code_id
        +UUID user_id
        +UUID order_id
        +UUID booking_id
        +numeric discount_amount
    }
    class Notification {
        +UUID id
        +UUID user_id
        +string type
        +string title
        +string body
        +bool is_read
    }
    class Dispute {
        +UUID id
        +UUID reporter_id
        +UUID reported_id
        +UUID booking_id
        +string reason
        +string status
    }
    class ChatSession {
        +UUID id
        +UUID user_id
        +string title
    }
    class ChatMessage {
        +UUID id
        +UUID session_id
        +string sender_type
        +string content
    }

    %% DB Relationships
    User "1" --> "0..1" TechnicianProfile : has profile
    User "1" --> "*" Booking : books as client
    User "1" --> "*" Order : places
    User "1" --> "0..1" WalletAccount : owns
    User "1" --> "*" Notification : receives
    User "1" --> "*" SavedPaymentMethod : stores
    User "1" --> "*" ChatSession : starts
    User "1" --> "*" Review : writes

    TechnicianProfile "1" --> "*" TechnicianGallery : has
    TechnicianProfile "1" --> "*" TechnicianSpecialization : has
    TechnicianProfile "1" --> "*" TechnicianWorkDay : schedules
    TechnicianProfile "1" --> "*" TimeSlot : defines
    TechnicianProfile "1" --> "*" Booking : receives
    TechnicianProfile "1" --> "*" Review : receives

    TechnicianSpecialization "*" --> "1" ServiceCategory : references
    ServiceCategory "0..1" --> "*" ServiceCategory : parent

    Booking "1" --> "*" BookingStatusHistory : tracks
    Booking "1" --> "0..1" Review : reviewed by
    Booking "0..1" --> "1" TimeSlot : uses slot
    Booking "*" --> "1" ServiceCategory : categorized

    Order "1" *-- "*" OrderItem : contains
    OrderItem "*" --> "1" Product : references
    Product "*" --> "0..1" ServiceCategory : categorized
    CartItem "*" --> "1" Product : references
    CartItem "*" --> "1" User : belongs to

    Payment "*" --> "0..1" Order : pays for order
    Payment "*" --> "0..1" Booking : pays for booking
    Payment "*" --> "1" User : paid by

    WalletAccount "1" --> "*" WalletTransaction : ledger
    PromoCode "1" --> "*" PromoRedemption : redeemed
    PromoRedemption "*" --> "1" User : used by

    Dispute "*" --> "1" User : reporter
    Dispute "*" --> "0..1" Booking : about

    ChatSession "1" *-- "*" ChatMessage : contains

    %% ════════════════════════════════════════════════════════════
    %% FRONTEND - APP & ROUTING
    %% ════════════════════════════════════════════════════════════

    class FrontendApp {
        +Routes
        +BrowserRouter
    }
    class AxiosInstance {
        +baseURL string
        +interceptors
        +get()
        +post()
        +put()
        +delete()
    }

    class MainLayout {
        +Navbar
        +Outlet
        +Footer
    }
    class Navbar {
        +links
        +authMenu
    }
    class Footer {
        +content
    }
    class DashboardLayout {
        +Sidebar
        +DashboardHeader
        +Outlet
    }
    class Sidebar {
        +sidebarConfig
        +menuItems
        +activeRoute
    }
    class DashboardHeader {
        +userInfo
        +notifications
        +search
    }
    class SidebarConfig {
        +clientMenu[]
        +technicianMenu[]
        +adminMenu[]
    }
    class FilterBar {
        +filters
        +onFilterChange()
    }
    class PageHeader {
        +title
        +actions
    }

    FrontendApp *-- MainLayout
    FrontendApp *-- DashboardLayout
    MainLayout *-- Navbar
    MainLayout *-- Footer
    DashboardLayout *-- Sidebar
    DashboardLayout *-- DashboardHeader
    Sidebar ..> SidebarConfig

    %% Guards
    class ProtectedRoute {
        +isAuthenticated bool
        +Outlet
    }
    class RoleGuard {
        +allowedRoles string[]
        +Outlet
    }
    class RoleRedirect {
        +path string
        +redirectByRole()
    }

    FrontendApp ..> ProtectedRoute
    ProtectedRoute ..> RoleGuard
    FrontendApp ..> RoleRedirect
    ProtectedRoute ..> AuthContext
    RoleGuard ..> AuthContext

    %% ════════════════════════════════════════════════════════════
    %% FRONTEND - CONTEXTS
    %% ════════════════════════════════════════════════════════════

    class AuthContext {
        +user
        +token
        +loading
        +isAuthenticated
        +login(email, pw)
        +register(data)
        +logout()
        +setUser()
    }
    class ToastContext {
        +toasts[]
        +addToast(msg, type)
        +removeToast(id)
    }
    class DashboardContext {
        +sidebarOpen bool
        +toggleSidebar()
    }

    AuthContext ..> AxiosInstance
    DashboardLayout ..> DashboardContext

    %% ════════════════════════════════════════════════════════════
    %% FRONTEND - HOOKS
    %% ════════════════════════════════════════════════════════════

    class useApi {
        +data
        +loading
        +error
        +execute()
    }
    class usePagination {
        +page
        +totalPages
        +setPage()
        +nextPage()
        +prevPage()
    }
    class useDebounce {
        +debouncedValue
    }
    class useAdminData {
        +data[]
        +loading
        +error
        +page
        +totalPages
        +total
        +setPage()
        +refetch()
        +filters
        +setFilters()
    }

    useAdminData ..> AxiosInstance
    useApi ..> AxiosInstance

    %% ════════════════════════════════════════════════════════════
    %% FRONTEND - API LAYER
    %% ════════════════════════════════════════════════════════════

    class AdminApi {
        +getStats()
        +getUsers()
        +getTechnicians()
        +getBookings()
        +getOrders()
        +getProducts()
        +getReviews()
        +getWallets()
        +getPromos()
        +getSupport()
    }
    class UsersApi {
        +getProfile()
        +updateProfile(data)
        +uploadAvatar(file)
        +updateGallery(files)
    }

    AdminApi ..> AxiosInstance
    UsersApi ..> AxiosInstance

    %% ════════════════════════════════════════════════════════════
    %% FRONTEND - REUSABLE UI COMPONENTS
    %% ════════════════════════════════════════════════════════════

    class DataTable {
        +columns[]
        +data[]
        +onSort()
        +onRowClick()
    }
    class Modal {
        +isOpen bool
        +onClose()
        +title string
        +children
    }
    class FileUpload {
        +accept string
        +maxSize number
        +onUpload()
        +preview bool
    }
    class Avatar {
        +src string
        +size string
        +fallback string
    }
    class PaginationUI {
        +page number
        +totalPages number
        +onPageChange()
    }
    class SearchBar {
        +value string
        +onChange()
        +placeholder string
    }
    class Select {
        +options[]
        +value
        +onChange()
    }
    class Tabs {
        +tabs[]
        +activeTab
        +onChange()
    }
    class StatCard {
        +title string
        +value string
        +icon
        +trend string
    }
    class Button {
        +variant string
        +size string
        +onClick()
    }
    class Card {
        +children
        +className string
    }
    class Badge {
        +variant string
        +label string
    }
    class Alert {
        +type string
        +message string
    }
    class Input {
        +type string
        +value
        +onChange()
    }
    class Spinner { +size }
    class Skeleton { +variant }
    class EmptyState {
        +title
        +description
        +icon
    }
    class StarRating {
        +rating number
        +maxStars number
    }
    class DropdownMenu {
        +items[]
        +trigger
    }
    class Textarea {
        +value
        +onChange()
    }

    %% ════════════════════════════════════════════════════════════
    %% FRONTEND - PUBLIC PAGES
    %% ════════════════════════════════════════════════════════════

    class HomePage { +heroSection +features +ctaSection }
    class LoginPage { +loginForm }
    class RegisterPage { +registerForm }
    class TechniciansListPage { +filters +technicianCards }
    class TechnicianProfilePage { +profileInfo +gallery +reviews +bookingForm }
    class MarketplacePage { +productGrid +filters +search }
    class ProductDetailPage { +productInfo +addToCart }
    class CheckoutPage { +cart +promoInput +paymentForm }
    class NotFoundPage { +message }

    HomePage ..> Button
    HomePage ..> Card
    LoginPage ..> AuthContext
    LoginPage ..> Input
    RegisterPage ..> AuthContext
    RegisterPage ..> Input
    TechniciansListPage ..> SearchBar
    TechniciansListPage ..> Card
    TechniciansListPage ..> StarRating
    TechnicianProfilePage ..> Avatar
    TechnicianProfilePage ..> StarRating
    TechnicianProfilePage ..> Tabs
    MarketplacePage ..> SearchBar
    MarketplacePage ..> Card
    MarketplacePage ..> PaginationUI
    ProductDetailPage ..> Button
    CheckoutPage ..> AuthContext

    MainLayout *-- HomePage
    MainLayout *-- LoginPage
    MainLayout *-- RegisterPage
    MainLayout *-- TechniciansListPage
    MainLayout *-- TechnicianProfilePage
    MainLayout *-- MarketplacePage
    MainLayout *-- ProductDetailPage

    %% ════════════════════════════════════════════════════════════
    %% FRONTEND - DASHBOARD PAGES
    %% ════════════════════════════════════════════════════════════

    class ClientOverview { +stats +recentBookings +recentOrders }
    class TechOverview { +stats +upcomingBookings +earnings }
    class AdminOverview { +platformStats +charts +recentActivity }
    class AdminUsersPage { +userTable +filters +editModal }
    class AdminTechniciansPage { +techTable +verifyActions }
    class AdminBookingsPage { +bookingTable +statusFilters }
    class AdminOrdersPage { +orderTable +statusActions }
    class AdminProductsPage { +productTable +createModal }
    class AdminPromosPage { +promoTable +createModal }
    class AdminWalletPage { +walletTable +adjustModal }
    class AdminSupportPage { +ticketTable +resolveActions }
    class AdminReviewsPage { +reviewTable +moderateActions }
    class MyBookingsPage { +bookingList +filters }
    class BookingDetailPage { +bookingInfo +statusActions +reviewForm }
    class MyOrdersPage { +orderList }
    class OrderDetailPage { +orderInfo +itemList }
    class ProfilePage { +profileForm +avatarUpload +tabs }

    AdminOverview ..> StatCard
    AdminOverview ..> useAdminData
    AdminUsersPage ..> DataTable
    AdminUsersPage ..> useAdminData
    AdminUsersPage ..> Modal
    AdminUsersPage ..> AdminApi
    AdminTechniciansPage ..> DataTable
    AdminTechniciansPage ..> useAdminData
    AdminBookingsPage ..> DataTable
    AdminBookingsPage ..> useAdminData
    AdminOrdersPage ..> DataTable
    AdminOrdersPage ..> useAdminData
    AdminProductsPage ..> DataTable
    AdminProductsPage ..> useAdminData
    AdminProductsPage ..> FileUpload
    AdminPromosPage ..> DataTable
    AdminPromosPage ..> useAdminData
    AdminPromosPage ..> Modal
    AdminWalletPage ..> DataTable
    AdminWalletPage ..> useAdminData
    AdminSupportPage ..> DataTable
    AdminSupportPage ..> useAdminData
    AdminReviewsPage ..> DataTable
    AdminReviewsPage ..> useAdminData

    ClientOverview ..> StatCard
    TechOverview ..> StatCard
    ProfilePage ..> FileUpload
    ProfilePage ..> Avatar
    ProfilePage ..> Tabs
    ProfilePage ..> UsersApi
    BookingDetailPage ..> StarRating
    BookingDetailPage ..> Badge
    MyBookingsPage ..> PaginationUI
    MyOrdersPage ..> PaginationUI
```
