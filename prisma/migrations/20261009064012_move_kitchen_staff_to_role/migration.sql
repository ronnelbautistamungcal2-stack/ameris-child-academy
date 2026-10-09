-- Kitchen staff used to be OTHER_STAFF users in the "Kitchen" department.
-- Move them to the KITCHEN_STAFF role, on the user and on their center memberships.
UPDATE "CenterUser" cu
SET "role" = 'KITCHEN_STAFF'
FROM "User" u
WHERE cu."userId" = u."id"
  AND cu."role" = 'OTHER_STAFF'
  AND lower(trim(u."staffDepartment")) = 'kitchen';

UPDATE "User"
SET "role" = CASE WHEN "role" = 'OTHER_STAFF' THEN 'KITCHEN_STAFF'::"Role" ELSE "role" END,
    "roles" = array_replace("roles", 'OTHER_STAFF'::"Role", 'KITCHEN_STAFF'::"Role")
WHERE lower(trim("staffDepartment")) = 'kitchen'
  AND ("role" = 'OTHER_STAFF' OR 'OTHER_STAFF' = ANY("roles"));
