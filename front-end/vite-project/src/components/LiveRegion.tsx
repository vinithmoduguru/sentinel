export default function LiveRegion({ text }: { text: string }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  )
}


