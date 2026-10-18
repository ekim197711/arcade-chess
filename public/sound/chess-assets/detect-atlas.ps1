$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Collections.Generic;
public class AtlasDetector {
 public static int[][] Detect(string path) {
  using(var b=new Bitmap(path)) {
   int w=b.Width,h=b.Height; bool[] mask=new bool[w*h],seen=new bool[w*h];
   for(int y=0;y<h;y++)for(int x=0;x<w;x++)mask[y*w+x]=b.GetPixel(x,y).A>=24;
   var parts=new List<int[]>();
   for(int p=0;p<w*h;p++) {
    if(seen[p]||!mask[p])continue;
    int count=0,left=w,top=h,right=0,bottom=0;
    var q=new Queue<int>();q.Enqueue(p);seen[p]=true;
    while(q.Count>0) {
     int a=q.Dequeue(),ax=a%w,ay=a/w;count++;
     left=Math.Min(left,ax);right=Math.Max(right,ax);top=Math.Min(top,ay);bottom=Math.Max(bottom,ay);
     for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++) {
      int nx=ax+dx,ny=ay+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
      int n=ny*w+nx;if(!seen[n]&&mask[n]){seen[n]=true;q.Enqueue(n);}
     }
    }
    if(count>1000)parts.Add(new int[]{left,top,right,bottom,count});
   }
   parts.Sort((a,c)=>c[4].CompareTo(a[4]));
   if(parts.Count<12)throw new Exception("Fewer than 12 figures: "+path);
   parts=parts.GetRange(0,12);
   parts.Sort((a,c)=>(a[1]+a[3]).CompareTo(c[1]+c[3]));
   var ordered=new List<int[]>();
   for(int row=0;row<2;row++){
    var group=parts.GetRange(row*6,6);group.Sort((a,c)=>(a[0]+a[2]).CompareTo(c[0]+c[2]));
    foreach(var r in group){int x=Math.Max(0,r[0]-2),y=Math.Max(0,r[1]-2);ordered.Add(new int[]{x,y,Math.Min(w-1,r[2]+2)-x+1,Math.Min(h-1,r[3]+2)-y+1});}
   }
   return ordered.ToArray();
  }
 }
}
'@
$root=$PSScriptRoot
$atlas=Get-Content "$root\atlas.json" -Raw | ConvertFrom-Json
$roles=@('king','queen','bishop','knight','rook','pawn')
$styles=@('norse-3d','egypt-3d','ocean-3d','steampunk-3d','forest-3d','samurai-3d','gothic-3d','candy-3d','space-3d','arctic-3d')
foreach($style in $styles){
 $rects=[AtlasDetector]::Detect("$root\$style.png")
 $pieces=@{}
 for($i=0;$i -lt 12;$i++){$color='white';if($i -ge 6){$color='black'};$pieces["$color-$($roles[$i%6])"]=$rects[$i]}
 $atlas | Add-Member -NotePropertyName $style -NotePropertyValue @{file="$style.png";width=1536;height=1024;pieces=$pieces} -Force
 Write-Output "$style : detected 12 figures"
}
$atlas | ConvertTo-Json -Depth 8 | Set-Content "$root\atlas.json" -Encoding utf8
