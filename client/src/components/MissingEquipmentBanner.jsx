export default function MissingEquipmentBanner({ missingEquipment }) {
  if (!missingEquipment || missingEquipment.length === 0) return null;

  return (
    <div className="banner banner-warning">
      Не хватает техники: {missingEquipment.join(', ')}
    </div>
  );
}
