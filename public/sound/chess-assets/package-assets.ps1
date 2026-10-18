$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
public class ChessAssetPack {
 public static Bitmap Extract(Bitmap source, int x, int y, int w, int h) {
  bool[] seen = new bool[w*h];
  List<int> largest = new List<int>();
  for(int p=0;p<w*h;p++) {
   if(seen[p] || source.GetPixel(x+p%w,y+p/w).A<24) continue;
   var component = new List<int>(); var queue = new Queue<int>();
   queue.Enqueue(p); seen[p]=true;
   while(queue.Count>0) {
    int a=queue.Dequeue(); component.Add(a);
    int ax=a%w, ay=a/w;
    for(int dy=-1;dy<=1;dy++) for(int dx=-1;dx<=1;dx++) {
     int nx=ax+dx, ny=ay+dy;
     if(nx<0||ny<0||nx>=w||ny>=h) continue;
     int n=ny*w+nx;
     if(!seen[n] && source.GetPixel(x+nx,y+ny).A>=24) {seen[n]=true;queue.Enqueue(n);}
    }
   }
   if(component.Count>largest.Count) largest=component;
  }
  if(largest.Count==0) throw new Exception("Empty sprite");
  int left=w,top=h,right=0,bottom=0;
  bool[] keep=new bool[w*h];
  foreach(int p in largest) {
   int px=p%w,py=p/w;
   for(int dy=-2;dy<=2;dy++) for(int dx=-2;dx<=2;dx++) {
    int nx=px+dx,ny=py+dy;
    if(nx<0||ny<0||nx>=w||ny>=h) continue;
    keep[ny*w+nx]=true;
    left=Math.Min(left,nx);right=Math.Max(right,nx);top=Math.Min(top,ny);bottom=Math.Max(bottom,ny);
   }
  }
  var result=new Bitmap(right-left+1,bottom-top+1,PixelFormat.Format32bppArgb);
  for(int py=top;py<=bottom;py++) for(int px=left;px<=right;px++)
   if(keep[py*w+px]) result.SetPixel(px-left,py-top,source.GetPixel(x+px,y+py));
  return result;
 }
 public static void Save(Bitmap piece,string path,int size) {
  Bitmap current=(Bitmap)piece.Clone();
  try {
  for(int pass=0;pass<12;pass++) {
  piece=current;
  int left=piece.Width,top=piece.Height,right=-1,bottom=-1;
  for(int y=0;y<piece.Height;y++)for(int x=0;x<piece.Width;x++)
   if(piece.GetPixel(x,y).A>0){left=Math.Min(left,x);right=Math.Max(right,x);top=Math.Min(top,y);bottom=Math.Max(bottom,y);}
  if(right<left)throw new Exception("Empty sprite");
  if(piece.Height==size && left==0 && top==0 && right==piece.Width-1 && bottom==piece.Height-1){piece.Save(path,ImageFormat.Png);return;}
  int width=Math.Max(1,(int)Math.Round((right-left+1)*(double)size/(bottom-top+1)));
  using(var cropped=piece.Clone(new Rectangle(left,top,right-left+1,bottom-top+1),PixelFormat.Format32bppArgb))
  {
  var target=new Bitmap(width,size,PixelFormat.Format32bppArgb);
  using(var g=Graphics.FromImage(target)) {
   g.Clear(Color.Transparent);
   g.InterpolationMode=InterpolationMode.HighQualityBicubic;
   g.PixelOffsetMode=PixelOffsetMode.HighQuality;
   using(var attributes=new ImageAttributes()){
    attributes.SetWrapMode(WrapMode.TileFlipXY);
    g.DrawImage(cropped,new Rectangle(0,0,width,size),0,0,cropped.Width,cropped.Height,GraphicsUnit.Pixel,attributes);
   }
  }
  current.Dispose();current=target;
  }
  }
  throw new Exception("Unable to tightly normalize sprite: "+path);
  } finally {current.Dispose();}
 }
}
'@
$root=$PSScriptRoot
$atlas=Get-Content -LiteralPath "$root\atlas.json" -Raw | ConvertFrom-Json
$manifest=@{sizes=@(256,512);sizeMeaning='image height in pixels; width preserves aspect ratio';format='png';anchor=@(0.5,1.0);styles=@{}}
foreach($style in $atlas.PSObject.Properties){
 $source=[System.Drawing.Bitmap]::new("$root\$($style.Value.file)")
 $pieces=@{}; $maxHeight=0; $maxWidth=0
 foreach($piece in $style.Value.pieces.PSObject.Properties){
  $r=$piece.Value
  $image=[ChessAssetPack]::Extract($source,$r[0],$r[1],$r[2],$r[3])
  $pieces[$piece.Name]=$image
  $maxHeight=[Math]::Max($maxHeight,$image.Height);$maxWidth=[Math]::Max($maxWidth,$image.Width)
 }
 $entries=@{}
 foreach($name in $pieces.Keys){
  $paths=@{}
  foreach($size in @(256,512)){
   $relative="pieces/$($style.Name)/$size/$name.png"
   $path=Join-Path $root $relative
   New-Item -ItemType Directory -Force -Path (Split-Path $path) | Out-Null
   [ChessAssetPack]::Save($pieces[$name],$path,$size)
   $paths["$size"]=$relative
  }
  $entries[$name]=$paths
  $pieces[$name].Dispose()
 }
 $manifest.styles[$style.Name]=$entries
 $source.Dispose()
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$root\manifest.json" -Encoding utf8
Write-Output 'Exported all themes as tightly cropped transparent PNGs with equal 256px or 512px heights.'
