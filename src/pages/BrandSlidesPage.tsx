import content from '../content/internal/slides.html?raw'

export function BrandSlidesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl" dangerouslySetInnerHTML={{ __html: content }} />
  )
}
