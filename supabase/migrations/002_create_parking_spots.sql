-- 1. Forum Mall Basement Parking
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'Forum Mall Basement Parking',
  'Hosur Road, Koramangala 1st Block, Bangalore 560029',
  60.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6102 12.9279)')
);

-- 2. Koramangala 5th Block Open Lot
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'Koramangala 5th Block Open Lot',
  '5th Block, Koramangala, Bangalore 560095',
  20.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6189 12.9341)')
);

-- 3. Sony World Junction Parking
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'Sony World Junction Parking',
  '80 Feet Road, Koramangala 4th Block, Bangalore 560034',
  30.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6231 12.9352)')
);

-- 4. Jyoti Nivas College Street Parking
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'Jyoti Nivas College Street Parking',
  'Hosur Road, Koramangala 6th Block, Bangalore 560095',
  15.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6143 12.9312)')
);

-- 5. Koramangala Club Road Parking
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'Koramangala Club Road Parking',
  'Koramangala Club Road, 3rd Block, Bangalore 560034',
  25.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6167 12.9368)')
);

-- 6. Empire Restaurant Parking
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'Empire Restaurant Parking',
  'Church Street Extension, Koramangala 7th Block, Bangalore 560095',
  20.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6258 12.9298)')
);

-- 7. Maharaja Agrasen Ground Parking
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'Maharaja Agrasen Ground Parking',
  '80 Feet Road, Koramangala 7th Block, Bangalore 560095',
  10.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6274 12.9321)')
);

-- 8. Koramangala 8th Block Market Parking
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'Koramangala 8th Block Market Parking',
  '8th Block, Koramangala, Bangalore 560095',
  20.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6301 12.9352)')
);

-- 9. Indiranagar Border Parking (BDA Complex)
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'BDA Complex Parking',
  'BDA Complex, Koramangala 2nd Block, Bangalore 560034',
  15.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6118 12.9389)')
);

-- 10. Wipro Park Road Parking
INSERT INTO parking_spots (name, address, price_per_hour, source, location)
VALUES (
  'Wipro Park Road Parking',
  'Sarjapur Road, Koramangala, Bangalore 560034',
  30.00,
  'google_raw',
  ST_GeogFromText('SRID=4326;POINT(77.6332 12.9274)')
);