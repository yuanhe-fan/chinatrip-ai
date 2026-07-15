/** Static LCP image kept outside the interactive homepage client boundary. */
export function HomeBackground() {
  return (
    <picture className="fixed inset-0 z-0 block bg-[#14243a]">
      <source
        media="(max-width: 767px)"
        srcSet="/home-great-wall-768.avif"
        type="image/avif"
      />
      <img
        src="/home-great-wall-1600.avif"
        alt=""
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </picture>
  );
}
