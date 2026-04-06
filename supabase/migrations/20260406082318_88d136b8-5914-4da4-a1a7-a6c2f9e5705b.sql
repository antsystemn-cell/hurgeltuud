
-- Role enum
CREATE TYPE public.app_role AS ENUM ('main_admin', 'operator', 'driver');

-- Fulfillment status enum
CREATE TYPE public.fulfillment_status AS ENUM (
  'confirmed',
  'phone_confirmed', 
  'out_for_delivery',
  'delivered',
  'cancelled'
);

-- Payment status enum
CREATE TYPE public.payment_status AS ENUM (
  'unpaid',
  'cash_on_delivery',
  'paid',
  'refunded'
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Source systems table
CREATE TABLE public.source_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  api_key TEXT,
  webhook_url TEXT,
  webhook_secret TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.source_systems ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_source_systems_updated_at BEFORE UPDATE ON public.source_systems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_order_number TEXT NOT NULL UNIQUE,
  source_system_id UUID REFERENCES public.source_systems(id),
  external_order_id TEXT,
  source_channel TEXT,
  idempotency_key TEXT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  district TEXT,
  address_text TEXT,
  delivery_note TEXT,
  payment_method TEXT,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  fulfillment_status public.fulfillment_status NOT NULL DEFAULT 'confirmed',
  delivery_fee NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  customer_note TEXT,
  internal_note TEXT,
  assigned_driver_user_id UUID REFERENCES auth.users(id),
  created_by_user_id UUID REFERENCES auth.users(id),
  updated_by_user_id UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  phone_confirmed_at TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_system_id, external_order_id)
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate internal order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.internal_order_number IS NULL OR NEW.internal_order_number = '' THEN
    NEW.internal_order_number := 'DLV-' || TO_CHAR(now(), 'YYMMDD') || '-' || LPAD(nextval('order_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;
CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- Order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  variant_snapshot TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Webhook logs table
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system_id UUID REFERENCES public.source_systems(id),
  order_id UUID REFERENCES public.orders(id),
  event_type TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER DEFAULT 1,
  success BOOLEAN DEFAULT false,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_orders_source_system ON public.orders(source_system_id);
CREATE INDEX idx_orders_fulfillment_status ON public.orders(fulfillment_status);
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_orders_assigned_driver ON public.orders(assigned_driver_user_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_idempotency ON public.orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_webhook_logs_order ON public.webhook_logs(order_id);

-- =====================
-- RLS POLICIES
-- =====================

-- Profiles: everyone can read, users update own
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles: admin-only management, authenticated can read own
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'main_admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'main_admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'main_admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'main_admin'));

-- Source systems: admin-only, operators can read
CREATE POLICY "Admins can manage source systems" ON public.source_systems FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'main_admin'));
CREATE POLICY "Operators can view source systems" ON public.source_systems FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'operator'));

-- Orders: role-based
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'main_admin'));
CREATE POLICY "Operators can view all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Operators can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Operators can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Drivers can view assigned orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'driver') AND assigned_driver_user_id = auth.uid());
CREATE POLICY "Drivers can update assigned orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'driver') AND assigned_driver_user_id = auth.uid());

-- Order items: follow order access
CREATE POLICY "Admins can manage all order items" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'main_admin'));
CREATE POLICY "Operators can view all order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Operators can insert order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Operators can update order items" ON public.order_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Drivers can view assigned order items" ON public.order_items FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'driver') AND
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.assigned_driver_user_id = auth.uid())
);

-- Audit logs: admin-only read, all authenticated can insert
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'main_admin'));
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Webhook logs: admin-only
CREATE POLICY "Admins can manage webhook logs" ON public.webhook_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'main_admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert initial source systems
INSERT INTO public.source_systems (name, code, active) VALUES
  ('Shop Only', 'shop_only_mn', true),
  ('EasyShop', 'easyshop_mn', true);
