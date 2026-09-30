CREATE TABLE camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  image TEXT NOT NULL,
  description TEXT NOT NULL
);
