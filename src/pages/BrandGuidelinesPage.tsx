import content from '../content/internal/design-system.html?raw'

export function BrandGuidelinesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl" dangerouslySetInnerHTML={{ __html: content }} />
  )
}
